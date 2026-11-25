import { syncMatches } from "../src/lib/sync";

syncMatches()
  .then((r) => { console.log("Synchronisation :", r); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
