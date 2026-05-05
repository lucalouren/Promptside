#!/usr/bin/env node
import { main } from "../dist/cli.js";

main().catch((err) => {
  process.stderr.write(`promptdiff: ${err?.message ?? err}\n`);
  process.exit(1);
});
