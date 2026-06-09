import { runMockScoringDemo } from "../src/lib/scoring/mockExample";

const result = runMockScoringDemo();
console.log(JSON.stringify(result, null, 2));
