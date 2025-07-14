const { danger, warn, fail, message } = require('danger');

// Check PR size
const bigPRThreshold = 600;
const additions = danger.github.pr.additions;
const deletions = danger.github.pr.deletions;
const totalChanges = additions + deletions;

if (totalChanges > bigPRThreshold) {
  warn(`:exclamation: Big PR - ${totalChanges} lines changed. Consider breaking it into smaller PRs.`);
}

// Ensure PR has a description
if (!danger.github.pr.body || danger.github.pr.body.length < 10) {
  fail('Please provide a meaningful PR description.');
}

// Check for console.log statements
const jsFiles = danger.git.created_files.concat(danger.git.modified_files)
  .filter(path => path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.tsx'));

jsFiles.forEach(file => {
  const content = danger.git.diffForFile(file);
  if (content && content.includes('console.log')) {
    warn(`Found console.log in ${file}. Please remove before merging.`);
  }
});

// Ensure tests are updated when source code changes
const hasSourceChanges = danger.git.modified_files.some(file => 
  file.includes('/src/') && (file.endsWith('.ts') || file.endsWith('.tsx'))
);

const hasTestChanges = danger.git.modified_files.some(file => 
  file.includes('.test.') || file.includes('.spec.')
);

if (hasSourceChanges && !hasTestChanges) {
  warn('Source code was modified but no tests were updated. Please ensure test coverage.');
}

// Check for changes to package.json without package-lock.json
const packageChanged = danger.git.modified_files.includes('package.json');
const lockfileChanged = danger.git.modified_files.includes('package-lock.json') || 
                       danger.git.modified_files.includes('pnpm-lock.yaml');

if (packageChanged && !lockfileChanged) {
  fail('Changes to package.json require updating the lockfile.');
}

// Encourage PR labels
if (danger.github.pr.labels.length === 0) {
  message('Please add appropriate labels to this PR.');
}

// Check for TODO comments
const todoPattern = /TODO|FIXME|HACK/i;
jsFiles.forEach(async file => {
  const content = await danger.git.diffForFile(file);
  if (content && todoPattern.test(content.added)) {
    warn(`Found TODO/FIXME/HACK comment in ${file}. Please create an issue to track this.`);
  }
});

// Celebrate small PRs
if (totalChanges < 50) {
  message(':tada: Small PR! Easy to review.');
}

// Check for security-sensitive file changes
const securityFiles = [
  'prisma/schema.prisma',
  '.env',
  '.env.example',
  'src/middleware/auth.ts',
  'src/services/encryptionService.ts'
];

const modifiedSecurityFiles = danger.git.modified_files.filter(file => 
  securityFiles.some(secFile => file.includes(secFile))
);

if (modifiedSecurityFiles.length > 0) {
  warn(`Security-sensitive files modified: ${modifiedSecurityFiles.join(', ')}. Please ensure proper review.`);
}

// Check commit messages
const commits = danger.git.commits;
const conventionalCommitPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+/;

commits.forEach(commit => {
  if (!conventionalCommitPattern.test(commit.message)) {
    warn(`Commit "${commit.message}" doesn't follow conventional commits format.`);
  }
});