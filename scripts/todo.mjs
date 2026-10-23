// Placeholder for npm scripts that a later task builds (see TASKS.md).
// --skip exits 0 so `npm run check` can include the script before it exists.
const [script, task, mode] = process.argv.slice(2);

if (mode === '--skip') {
  console.log(`SKIPPED: ${script} is not built yet (task ${task} in TASKS.md).`);
} else {
  console.error(`${script} is not built yet (task ${task} in TASKS.md).`);
  process.exitCode = 1;
}
