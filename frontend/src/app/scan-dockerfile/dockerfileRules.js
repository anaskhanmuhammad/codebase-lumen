/**
 * Dockerfile Security & Best Practices Rules
 * Defines various rules for analyzing Docker files
 */

export const RULES = {
  // Security Issues
  SUDO_USAGE: {
    id: 'sudo-usage',
    name: 'Sudo Usage',
    description: 'Avoid using `sudo` in Dockerfile as Docker containers run as root by default',
    severity: 'high',
    pattern: /\bsudo\b/i,
    fix: 'Remove `sudo` commands',
  },
  RUN_AS_ROOT: {
    id: 'run-as-root',
    name: 'Running as Root',
    description: 'Running containers as root is a security risk. Create a non-root user.',
    severity: 'high',
    pattern: null, // Manual check
    check: (content) => {
      const hasUser = /USER\s+\w+/i.test(content);
      const isRoot = !/USER\s+root/i.test(content);
      return !hasUser || !isRoot;
    },
    fix: 'Add USER directive to run as non-root user',
  },
  HARDCODED_SECRETS: {
    id: 'hardcoded-secrets',
    name: 'Hardcoded Secrets',
    description: 'Avoid hardcoding secrets, API keys, or credentials in Dockerfile',
    severity: 'critical',
    pattern: /(password|secret|api[_-]?key|token|aws_|db_password|DATABASE_URL)\s*=|ENV\s+(PASSWORD|SECRET|API_KEY|TOKEN)/i,
    fix: 'Use Docker secrets or environment variables from external sources',
  },
  LATEST_TAG: {
    id: 'latest-tag',
    name: 'Using Latest Tag',
    description: 'Using `latest` tag is unpredictable. Always specify a version.',
    severity: 'medium',
    pattern: /FROM\s+\S+:latest/i,
    fix: 'Specify a specific version tag instead of `latest`',
  },

  // Best Practices
  MISSING_LABELS: {
    id: 'missing-labels',
    name: 'Missing Labels',
    description: 'LABEL instructions provide metadata about the image',
    severity: 'low',
    pattern: null,
    check: (content) => !/LABEL\s+/i.test(content),
    fix: 'Add LABEL instructions for image metadata',
  },
  NO_HEALTHCHECK: {
    id: 'no-healthcheck',
    name: 'Missing HEALTHCHECK',
    description: 'HEALTHCHECK helps Docker monitor container health',
    severity: 'medium',
    pattern: null,
    check: (content) => !/HEALTHCHECK\s+/i.test(content),
    fix: 'Consider adding HEALTHCHECK instruction',
  },
  MULTIPLE_RUN_STATEMENTS: {
    id: 'multiple-run-statements',
    name: 'Multiple RUN Statements',
    description: 'Chain RUN commands with && to reduce image layers and size',
    severity: 'low',
    pattern: null,
    check: (content) => {
      const runs = content.match(/^RUN\s+/gm) || [];
      return runs.length > 3; // Flag if more than 3 RUN statements
    },
    fix: 'Combine multiple RUN statements into single command with &&',
  },
  MISSING_WORKDIR: {
    id: 'missing-workdir',
    name: 'Missing WORKDIR',
    description: 'WORKDIR improves clarity and provides a consistent working directory',
    severity: 'low',
    pattern: null,
    check: (content) => !/WORKDIR\s+/i.test(content),
    fix: 'Add WORKDIR instruction to set working directory',
  },
  COPY_INSTEAD_OF_ADD: {
    id: 'copy-instead-of-add',
    name: 'Using ADD Instead of COPY',
    description: 'COPY is preferred over ADD for clarity and security (ADD can extract tar)',
    severity: 'medium',
    pattern: /^ADD\s+/im,
    fix: 'Use COPY instead of ADD unless you need automatic extraction',
  },
  NO_ENTRYPOINT: {
    id: 'no-entrypoint',
    name: 'Missing ENTRYPOINT',
    description: 'ENTRYPOINT makes container behave like a standalone executable',
    severity: 'low',
    pattern: null,
    check: (content) => !/ENTRYPOINT\s+/i.test(content) && !/CMD\s+\[/i.test(content),
    fix: 'Add ENTRYPOINT or CMD instruction',
  },
  APK_NO_CACHE: {
    id: 'apk-no-cache',
    name: 'APK without --no-cache',
    description: 'Use --no-cache with apk to reduce image size (Alpine)',
    severity: 'low',
    pattern: /apk\s+add\s+(?!.*--no-cache)/i,
    fix: 'Add --no-cache flag: apk add --no-cache',
  },
  APT_NO_CACHE: {
    id: 'apt-no-cache',
    name: 'APT Cache Not Cleaned',
    description: 'Clean apt cache to reduce image size (Debian/Ubuntu)',
    severity: 'low',
    pattern: null,
    check: (content) => {
      const hasApt = /apt-get\s+install/i.test(content);
      const hasClean = /rm\s+-rf\s+\/var\/lib\/apt\/lists/i.test(content);
      return hasApt && !hasClean;
    },
    fix: 'Add: && rm -rf /var/lib/apt/lists/*',
  },
  EXPOSE_MISSING: {
    id: 'expose-missing',
    name: 'Missing EXPOSE',
    description: 'EXPOSE documents which ports your application uses',
    severity: 'low',
    pattern: null,
    check: (content) => !/EXPOSE\s+/i.test(content),
    fix: 'Add EXPOSE instruction for service ports',
  },

  // Docker Security Best Practices
  PRIVILEGED_MODE: {
    id: 'privileged-mode',
    name: 'Potential Privileged Mode',
    description: 'Check if containers are run in privileged mode (high risk)',
    severity: 'high',
    pattern: /--privileged/i,
    fix: 'Avoid --privileged flag; use specific capabilities instead',
  },
  NO_USER_SPECIFIED: {
    id: 'no-user-specified',
    name: 'No User Specified',
    description: 'Always specify a non-root user to run the application',
    severity: 'high',
    pattern: null,
    check: (content) => !/^USER\s+(?!root)/im.test(content),
    fix: 'Add USER instruction with a non-root user',
  },
};

export const SEVERITY_LEVELS = {
  critical: { level: 4, color: 'bg-red-100 border-red-300 text-red-800' },
  high: { level: 3, color: 'bg-orange-100 border-orange-300 text-orange-800' },
  medium: { level: 2, color: 'bg-yellow-100 border-yellow-300 text-yellow-800' },
  low: { level: 1, color: 'bg-blue-100 border-blue-300 text-blue-800' },
  info: { level: 0, color: 'bg-gray-100 border-gray-300 text-gray-800' },
};

export const getTotalRules = () => Object.keys(RULES).length;

export const getRuleById = (ruleId) => {
  for (const rule of Object.values(RULES)) {
    if (rule.id === ruleId) return rule;
  }
  return null;
};
