import { RULES } from './dockerfileRules';

/**
 * Validates a Dockerfile against defined rules
 * Returns array of violations found
 */
export const validateDockerfile = (dockerfileContent) => {
  if (!dockerfileContent || dockerfileContent.trim() === '') {
    return {
      violations: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      isValid: false,
    };
  }

  const violations = [];
  const lines = dockerfileContent.split('\n');

  Object.entries(RULES).forEach(([key, rule]) => {
    let found = false;
    let matchedLines = [];

    if (rule.check) {
      // Use custom check function
      if (rule.check(dockerfileContent)) {
        found = true;
        matchedLines = findRuleLines(dockerfileContent, rule);
      }
    } else if (rule.pattern) {
      // Use regex pattern
      lines.forEach((line, index) => {
        if (rule.pattern.test(line)) {
          found = true;
          matchedLines.push(index + 1);
        }
      });
    }

    if (found) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        description: rule.description,
        severity: rule.severity,
        fix: rule.fix,
        matchedLines: matchedLines,
      });
    }
  });

  // Sort by severity
  violations.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  // Count violations by severity
  const summary = {
    total: violations.length,
    critical: violations.filter((v) => v.severity === 'critical').length,
    high: violations.filter((v) => v.severity === 'high').length,
    medium: violations.filter((v) => v.severity === 'medium').length,
    low: violations.filter((v) => v.severity === 'low').length,
  };

  return {
    violations,
    summary,
    isValid: summary.critical === 0 && summary.high === 0,
  };
};

/**
 * Finds line numbers where a rule is violated
 */
const findRuleLines = (content, rule) => {
  const lines = [];
  const contentLines = content.split('\n');

  if (rule.id === 'multiple-run-statements') {
    contentLines.forEach((line, index) => {
      if (/^RUN\s+/im.test(line)) {
        lines.push(index + 1);
      }
    });
  } else if (rule.id === 'no-healthcheck') {
    if (!/HEALTHCHECK\s+/i.test(content)) {
      lines.push(1); // Flag first line
    }
  } else if (rule.id === 'missing-labels') {
    if (!/LABEL\s+/i.test(content)) {
      lines.push(1);
    }
  } else if (rule.id === 'missing-workdir') {
    if (!/WORKDIR\s+/i.test(content)) {
      lines.push(1);
    }
  } else if (rule.id === 'apt-no-cache') {
    contentLines.forEach((line, index) => {
      if (/apt-get\s+install/i.test(line)) {
        lines.push(index + 1);
      }
    });
  }

  return lines.length > 0 ? lines : [1];
};

/**
 * Gets recommendation based on violations
 */
export const getRecommendation = (summary) => {
  if (summary.critical > 0) {
    return {
      status: 'Critical Issues Found',
      message: 'Your Dockerfile has critical security issues that must be addressed immediately.',
      color: 'text-red-600',
    };
  } else if (summary.high > 0) {
    return {
      status: 'High Priority Issues',
      message: 'Your Dockerfile has high-priority issues that should be addressed.',
      color: 'text-orange-600',
    };
  } else if (summary.medium > 0) {
    return {
      status: 'Medium Priority Issues',
      message: 'Consider addressing these medium-priority issues to improve your Dockerfile.',
      color: 'text-yellow-600',
    };
  } else if (summary.low > 0) {
    return {
      status: 'Minor Suggestions',
      message: 'Your Dockerfile looks good overall. Consider these minor improvements.',
      color: 'text-blue-600',
    };
  } else {
    return {
      status: 'Excellent!',
      message: 'Your Dockerfile follows all best practices and security guidelines.',
      color: 'text-green-600',
    };
  }
};
