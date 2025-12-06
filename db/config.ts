import { defineDb } from "astro:db";
import {
  TextbookDocuments,
  TextbookPages,
  TextbookHighlights,
  ScanJobs,
} from "./tables";

export default defineDb({
  tables: {
    TextbookDocuments,
    TextbookPages,
    TextbookHighlights,
    ScanJobs,
  },
});
