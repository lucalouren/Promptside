#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ override: true });
import { main } from "../dist/cli.js";

main().catch((err) => {
  process.stderr.write(`llmdiff: ${err?.message ?? err}\n`);
  process.exit(1);
});
