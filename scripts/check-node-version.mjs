// Fails fast when the unit suite would run on a Node major it is not validated on.
// On Node 26+ `localStorage` is an accessor that returns undefined, so tests fail for
// runtime reasons rather than because of the code under test.
const REQUIRED_MAJOR = 22;
const major = Number.parseInt(process.versions.node.split('.')[0], 10);

if (major !== REQUIRED_MAJOR) {
  console.error(
    `\nSparktype tests require Node ${REQUIRED_MAJOR}.x (found ${process.versions.node}).\n` +
      `Run \`nvm use\` (picks up .nvmrc) and try again.\n`,
  );
  process.exit(1);
}
