import { column, defineTable, NOW } from "astro:db";

/**
 * A scanned textbook or chapter.
 * Example: "Class 11 Physics – Chapter 2", "Biology Unit 4 Notes".
 */
export const TextbookDocuments = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    ownerId: column.text(), // parent Users.id

    title: column.text(),
    description: column.text({ optional: true }),

    // Optional curriculum metadata
    subject: column.text({ optional: true }),
    gradeLevel: column.text({ optional: true }),
    board: column.text({ optional: true }), // CBSE, State Board, etc.

    // Original file info if they upload a PDF
    sourceType: column.text({
      enum: ["pdf", "image_set", "other"],
      default: "image_set",
    }),
    sourceMeta: column.json({ optional: true }), // file name, pages, etc.

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * Individual scanned pages belonging to a document.
 */
export const TextbookPages = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    documentId: column.number({
      references: () => TextbookDocuments.columns.id,
    }),

    pageNumber: column.number({ default: 1 }),

    // Where the page image/PDF slice is stored (object storage URL, etc.)
    imageUrl: column.text({ optional: true }),

    // OCR raw text for that page
    ocrText: column.text({ optional: true }),

    // Optional layout/blocks as structured JSON
    ocrBlocks: column.json({ optional: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * Extracted key info from pages:
 * key points, questions, definitions, formulas, etc.
 */
export const TextbookHighlights = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    documentId: column.number({
      references: () => TextbookDocuments.columns.id,
    }),
    pageId: column.number({
      references: () => TextbookPages.columns.id,
      optional: true,
    }),

    // Kind of highlight
    highlightType: column.text({
      enum: ["key_point", "question", "definition", "formula", "other"],
      default: "key_point",
    }),

    // Main extracted text
    content: column.text(),

    // Optional extra info (e.g. MCQ options, formula TeX, etc.)
    meta: column.json({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

/**
 * Logs for OCR/AI scans.
 */
export const ScanJobs = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    documentId: column.number({
      references: () => TextbookDocuments.columns.id,
      optional: true,
    }),
    pageId: column.number({
      references: () => TextbookPages.columns.id,
      optional: true,
    }),

    userId: column.text({ optional: true }),

    jobType: column.text({
      enum: ["ocr", "highlight_extraction", "full_pipeline", "other"],
      default: "full_pipeline",
    }),

    input: column.json({ optional: true }),
    output: column.json({ optional: true }),

    status: column.text({
      enum: ["pending", "completed", "failed"],
      default: "completed",
    }),

    createdAt: column.date({ default: NOW }),
  },
});

export const smartTextbookScannerTables = {
  TextbookDocuments,
  TextbookPages,
  TextbookHighlights,
  ScanJobs,
} as const;
