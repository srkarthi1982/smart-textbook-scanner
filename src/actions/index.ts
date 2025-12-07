import type { ActionAPIContext } from "astro:actions";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import {
  db,
  eq,
  and,
  TextbookDocuments,
  TextbookPages,
  TextbookHighlights,
  ScanJobs,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createDocument: defineAction({
    input: z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      subject: z.string().optional(),
      gradeLevel: z.string().optional(),
      board: z.string().optional(),
      sourceType: z.enum(["pdf", "image_set", "other"]).optional(),
      sourceMeta: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [document] = await db
        .insert(TextbookDocuments)
        .values({
          ownerId: user.id,
          title: input.title,
          description: input.description,
          subject: input.subject,
          gradeLevel: input.gradeLevel,
          board: input.board,
          sourceType: input.sourceType ?? "image_set",
          sourceMeta: input.sourceMeta,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { document };
    },
  }),

  updateDocument: defineAction({
    input: z.object({
      id: z.number().int(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      subject: z.string().optional(),
      gradeLevel: z.string().optional(),
      board: z.string().optional(),
      sourceType: z.enum(["pdf", "image_set", "other"]).optional(),
      sourceMeta: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(TextbookDocuments)
        .where(and(eq(TextbookDocuments.id, id), eq(TextbookDocuments.ownerId, user.id)))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Document not found.",
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { document: existing };
      }

      const [document] = await db
        .update(TextbookDocuments)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(TextbookDocuments.id, id), eq(TextbookDocuments.ownerId, user.id)))
        .returning();

      return { document };
    },
  }),

  listDocuments: defineAction({
    input: z.object({}).optional(),
    handler: async (_, context) => {
      const user = requireUser(context);

      const documents = await db
        .select()
        .from(TextbookDocuments)
        .where(eq(TextbookDocuments.ownerId, user.id));

      return { documents };
    },
  }),

  getDocumentWithPages: defineAction({
    input: z.object({
      id: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [document] = await db
        .select()
        .from(TextbookDocuments)
        .where(and(eq(TextbookDocuments.id, input.id), eq(TextbookDocuments.ownerId, user.id)))
        .limit(1);

      if (!document) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Document not found.",
        });
      }

      const pages = await db
        .select()
        .from(TextbookPages)
        .where(eq(TextbookPages.documentId, input.id));

      return { document, pages };
    },
  }),

  savePage: defineAction({
    input: z.object({
      id: z.number().int().optional(),
      documentId: z.number().int(),
      pageNumber: z.number().int().positive().optional(),
      imageUrl: z.string().url().optional(),
      ocrText: z.string().optional(),
      ocrBlocks: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [document] = await db
        .select()
        .from(TextbookDocuments)
        .where(and(eq(TextbookDocuments.id, input.documentId), eq(TextbookDocuments.ownerId, user.id)))
        .limit(1);

      if (!document) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Document not found.",
        });
      }

      const baseValues = {
        documentId: input.documentId,
        pageNumber: input.pageNumber ?? 1,
        imageUrl: input.imageUrl,
        ocrText: input.ocrText,
        ocrBlocks: input.ocrBlocks,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (input.id) {
        const [existing] = await db
          .select()
          .from(TextbookPages)
          .where(eq(TextbookPages.id, input.id))
          .limit(1);

        if (!existing || existing.documentId !== input.documentId) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Page not found.",
          });
        }

        const [page] = await db
          .update(TextbookPages)
          .set(baseValues)
          .where(eq(TextbookPages.id, input.id))
          .returning();

        return { page };
      }

      const [page] = await db.insert(TextbookPages).values(baseValues).returning();
      return { page };
    },
  }),

  deletePage: defineAction({
    input: z.object({
      id: z.number().int(),
      documentId: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [document] = await db
        .select()
        .from(TextbookDocuments)
        .where(and(eq(TextbookDocuments.id, input.documentId), eq(TextbookDocuments.ownerId, user.id)))
        .limit(1);

      if (!document) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Document not found.",
        });
      }

      const [deleted] = await db
        .delete(TextbookPages)
        .where(and(eq(TextbookPages.id, input.id), eq(TextbookPages.documentId, input.documentId)))
        .returning();

      if (!deleted) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Page not found.",
        });
      }

      return { page: deleted };
    },
  }),

  saveHighlight: defineAction({
    input: z.object({
      id: z.number().int().optional(),
      documentId: z.number().int(),
      pageId: z.number().int().optional(),
      highlightType: z
        .enum(["key_point", "question", "definition", "formula", "other"])
        .optional(),
      content: z.string().min(1, "Content is required"),
      meta: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [document] = await db
        .select()
        .from(TextbookDocuments)
        .where(and(eq(TextbookDocuments.id, input.documentId), eq(TextbookDocuments.ownerId, user.id)))
        .limit(1);

      if (!document) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Document not found.",
        });
      }

      if (input.pageId) {
        const [page] = await db
          .select()
          .from(TextbookPages)
          .where(
            and(
              eq(TextbookPages.id, input.pageId),
              eq(TextbookPages.documentId, input.documentId)
            )
          )
          .limit(1);

        if (!page) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Page not found.",
          });
        }
      }

      const baseValues = {
        documentId: input.documentId,
        pageId: input.pageId,
        highlightType: input.highlightType ?? "key_point",
        content: input.content,
        meta: input.meta,
        createdAt: new Date(),
      };

      if (input.id) {
        const [existing] = await db
          .select()
          .from(TextbookHighlights)
          .where(eq(TextbookHighlights.id, input.id))
          .limit(1);

        if (!existing || existing.documentId !== input.documentId) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Highlight not found.",
          });
        }

        const [highlight] = await db
          .update(TextbookHighlights)
          .set(baseValues)
          .where(eq(TextbookHighlights.id, input.id))
          .returning();

        return { highlight };
      }

      const [highlight] = await db.insert(TextbookHighlights).values(baseValues).returning();
      return { highlight };
    },
  }),

  deleteHighlight: defineAction({
    input: z.object({
      id: z.number().int(),
      documentId: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [document] = await db
        .select()
        .from(TextbookDocuments)
        .where(and(eq(TextbookDocuments.id, input.documentId), eq(TextbookDocuments.ownerId, user.id)))
        .limit(1);

      if (!document) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Document not found.",
        });
      }

      const [deleted] = await db
        .delete(TextbookHighlights)
        .where(
          and(
            eq(TextbookHighlights.id, input.id),
            eq(TextbookHighlights.documentId, input.documentId)
          )
        )
        .returning();

      if (!deleted) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Highlight not found.",
        });
      }

      return { highlight: deleted };
    },
  }),

  createScanJob: defineAction({
    input: z.object({
      documentId: z.number().int().optional(),
      pageId: z.number().int().optional(),
      jobType: z.enum(["ocr", "highlight_extraction", "full_pipeline", "other"]).optional(),
      input: z.any().optional(),
      output: z.any().optional(),
      status: z.enum(["pending", "completed", "failed"]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.documentId) {
        const [doc] = await db
          .select()
          .from(TextbookDocuments)
          .where(and(eq(TextbookDocuments.id, input.documentId), eq(TextbookDocuments.ownerId, user.id)))
          .limit(1);

        if (!doc) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Document not found.",
          });
        }
      }

      if (input.pageId) {
        const [page] = await db
          .select()
          .from(TextbookPages)
          .where(eq(TextbookPages.id, input.pageId))
          .limit(1);

        if (!page) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Page not found.",
          });
        }
      }

      const [job] = await db
        .insert(ScanJobs)
        .values({
          documentId: input.documentId,
          pageId: input.pageId,
          userId: user.id,
          jobType: input.jobType ?? "full_pipeline",
          input: input.input,
          output: input.output,
          status: input.status ?? "pending",
          createdAt: new Date(),
        })
        .returning();

      return { job };
    },
  }),

  listScanJobs: defineAction({
    input: z
      .object({
        documentId: z.number().int().optional(),
        pageId: z.number().int().optional(),
        status: z.enum(["pending", "completed", "failed"]).optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);

      const documents = await db
        .select()
        .from(TextbookDocuments)
        .where(eq(TextbookDocuments.ownerId, user.id));

      const allowedDocIds = new Set(documents.map((d) => d.id));

      const jobs = await db
        .select()
        .from(ScanJobs)
        .where(eq(ScanJobs.userId, user.id));

      const filtered = jobs.filter((job) => {
        const matchesDoc = job.documentId ? allowedDocIds.has(job.documentId) : true;
        const matchesPage = input?.pageId ? job.pageId === input.pageId : true;
        const matchesStatus = input?.status ? job.status === input.status : true;
        const matchesRequestedDoc = input?.documentId ? job.documentId === input.documentId : true;
        return matchesDoc && matchesPage && matchesStatus && matchesRequestedDoc;
      });

      return { jobs: filtered };
    },
  }),
};
