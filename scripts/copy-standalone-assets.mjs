// The standalone server does not include static assets. Copy them next to it
// so that `npm start` serves the complete app.
import { cpSync, existsSync } from "node:fs";

if (existsSync(".next/standalone")) {
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  if (existsSync("public")) {
    cpSync("public", ".next/standalone/public", { recursive: true });
  }
}
