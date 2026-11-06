import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Section } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GeneratedSection } from '../ai/ai.types';
import {
  FULL_EXAM_SECTION_ORDER,
  SECTION_BLUEPRINTS,
} from '../common/toefl.constants';
import { GenerateExamDto } from './dto/exam.dto';

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /**
   * Generate a new exam blueprint for the user. For FULL exams, generates all
   * four sections; for SECTION exams, only the requested section. Reading and
   * Listening are fully populated with questions; Speaking/Writing contain
   * tasks (graded in later phases).
   */
  async generate(userId: string, dto: GenerateExamDto) {
    const difficulty = dto.difficulty ?? 'standard';
    const sections: Section[] =
      dto.kind === 'FULL'
        ? FULL_EXAM_SECTION_ORDER
        : [this.requireSection(dto)];

    const avoidTopics = await this.recentTopics(userId);

    const title =
      dto.kind === 'FULL'
        ? `Full TOEFL Simulation (${difficulty})`
        : `${sections[0]} Practice (${difficulty})`;

    const exam = await this.prisma.exam.create({
      data: {
        kind: dto.kind,
        title,
        section: dto.kind === 'SECTION' ? sections[0] : null,
        difficulty,
        generatedBy: this.ai.activeProvider,
      },
    });

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const bp = SECTION_BLUEPRINTS[section];
      const generated = await this.ai.generateSection({
        section,
        difficulty,
        passages: bp.passages,
        questionsPerPassage: bp.questionsPerPassage,
        avoidTopics,
      });
      await this.persistSection(exam.id, section, i, generated);
    }

    // Store a content hash to discourage accidental duplicates.
    await this.prisma.exam.update({
      where: { id: exam.id },
      data: { contentHash: crypto.randomUUID() },
    });

    return this.findById(exam.id);
  }

  private requireSection(dto: GenerateExamDto): Section {
    if (!dto.section) {
      throw new BadRequestException('section is required when kind=SECTION');
    }
    return dto.section as Section;
  }

  private async persistSection(
    examId: string,
    section: Section,
    order: number,
    generated: GeneratedSection,
  ) {
    const bp = SECTION_BLUEPRINTS[section];
    const examSection = await this.prisma.examSection.create({
      data: {
        examId,
        section,
        order,
        timeLimitSec: bp.timeLimitSec,
        instructions: generated.instructions || bp.instructions,
      },
    });

    // Objective sections (Reading/Listening)
    let questionOrder = 0;
    for (let p = 0; p < generated.passages.length; p++) {
      const gp = generated.passages[p];
      const passage = await this.prisma.passage.create({
        data: {
          examSectionId: examSection.id,
          order: p,
          title: gp.title,
          body: gp.body,
          audioUrl: null, // TTS synthesized in phase 2; transcript is in body
          topic: gp.topic,
          wordCount: gp.body.split(/\s+/).filter(Boolean).length,
        },
      });

      for (const gq of gp.questions) {
        await this.prisma.question.create({
          data: {
            examSectionId: examSection.id,
            passageId: passage.id,
            order: questionOrder++,
            type: gq.type,
            section,
            prompt: gq.prompt,
            options: gq.options as unknown as Prisma.InputJsonValue,
            correctAnswer: gq.correctAnswer as unknown as Prisma.InputJsonValue,
            explanation: gq.explanation,
            skillTag: gq.skillTag,
            points: gq.points,
          },
        });
      }
    }

    // Productive sections (Speaking/Writing): store tasks as questions w/o options
    if (generated.tasks?.length) {
      for (const task of generated.tasks) {
        await this.prisma.question.create({
          data: {
            examSectionId: examSection.id,
            order: questionOrder++,
            type: task.type,
            section,
            prompt: task.stimulus
              ? `${task.stimulus}\n\n${task.prompt}`
              : task.prompt,
            options: Prisma.JsonNull,
            correctAnswer: Prisma.JsonNull,
            skillTag: task.skillTag,
            points: 0,
          },
        });
      }
    }
  }

  /** Topics used in the user's recent exams, to reduce repetition. */
  private async recentTopics(userId: string): Promise<string[]> {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 3,
      select: {
        exam: {
          select: {
            sections: { select: { passages: { select: { topic: true } } } },
          },
        },
      },
    });
    const topics = new Set<string>();
    for (const a of attempts) {
      for (const s of a.exam.sections) {
        for (const p of s.passages) {
          if (p.topic) topics.add(p.topic);
        }
      }
    }
    return [...topics];
  }

  async findById(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            passages: { orderBy: { order: 'asc' } },
            questions: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async list() {
    return this.prisma.exam.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        kind: true,
        title: true,
        section: true,
        difficulty: true,
        generatedBy: true,
        createdAt: true,
      },
    });
  }
}
