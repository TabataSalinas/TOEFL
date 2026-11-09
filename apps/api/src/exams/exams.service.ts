import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { FULL_EXAM_SECTION_ORDER, MODULE_BLUEPRINTS, SectionName, moduleCount } from '../common/toefl.constants';
import { sha1 } from '../content/text-utils';
import { ExamBuilderService } from './exam-builder.service';
import { GenerateExamDto } from './dto/exam.dto';

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly builder: ExamBuilderService,
  ) {}

  /**
   * Generate an exam in the 2026 format. Module 1 of each section is built now;
   * Reading/Listening module 2 is built when module 1 is finished (adaptive routing).
   */
  async generate(userId: string, dto: GenerateExamDto) {
    const difficulty = dto.difficulty ?? 'standard';
    if (dto.kind === 'SECTION' && !dto.section) {
      throw new BadRequestException('section is required when kind=SECTION');
    }
    const sections: SectionName[] = dto.kind === 'FULL' ? FULL_EXAM_SECTION_ORDER : [dto.section as SectionName];

    const exam = await this.prisma.exam.create({
      data: {
        kind: dto.kind,
        title: dto.kind === 'FULL' ? 'Full TOEFL iBT simulation (2026 format)' : `${sections[0][0]}${sections[0].slice(1).toLowerCase()} practice (2026 format)`,
        section: dto.kind === 'SECTION' ? sections[0] : null,
        difficulty,
        generatedBy: this.ai.activeProvider,
      },
    });

    try {
      const history = await this.builder.history(userId);
      await Promise.all(
        sections.map((section, i) =>
          this.builder.buildModule({ examId: exam.id, userId, section, module: 1, variant: 'core', order: i, history }),
        ),
      );
    } catch (err) {
      await this.prisma.exam.delete({ where: { id: exam.id } }).catch(() => undefined);
      throw err;
    }

    const bodies = await this.prisma.passage.findMany({ where: { examSection: { examId: exam.id } }, select: { contentFingerprint: true } });
    await this.prisma.exam.update({
      where: { id: exam.id },
      data: { contentHash: sha1(bodies.map((b) => b.contentFingerprint ?? '').join('|')) },
    });
    return this.summary(exam.id);
  }

  /**
   * Blueprint summary WITHOUT questions, options or answers — safe to show before and
   * during an attempt (no answer leakage).
   */
  async summary(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { sections: { orderBy: [{ order: 'asc' }, { module: 'asc' }], include: { _count: { select: { questions: true } } } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    const sections = [...new Set(exam.sections.map((s) => s.section))].map((section) => {
      const mods = exam.sections.filter((s) => s.section === section);
      return {
        section,
        moduleCount: moduleCount(section as SectionName),
        built: mods.map((m) => ({ module: m.module, variant: m.variant, questions: m._count.questions, timeLimitSec: m.timeLimitSec })),
        tasks: (MODULE_BLUEPRINTS.find((b) => b.section === section && b.module === 1)?.tasks ?? []).map((t) => ({ kind: t.kind, title: t.title })),
      };
    });
    return {
      id: exam.id,
      kind: exam.kind,
      title: exam.title,
      section: exam.section,
      difficulty: exam.difficulty,
      generatedBy: exam.generatedBy,
      createdAt: exam.createdAt,
      sections,
    };
  }

  async list() {
    return this.prisma.exam.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, kind: true, title: true, section: true, difficulty: true, generatedBy: true, createdAt: true },
    });
  }
}
