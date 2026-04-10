// Client-side template validation

export function validateEmailTemplate(template: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validVariables = [
    'websiteName',
    'websiteUrl',
    'changeDate',
    'changeType',
    'pageTitle',
    'viewChangesUrl',
    'aiMeaningfulScore',
    'aiIsMeaningful',
    'aiReasoning',
    'aiModel',
    'aiAnalyzedAt'
  ];

  // Check for empty template
  if (!template.trim()) {
    errors.push('Email template cannot be empty');
    return { isValid: false, errors };
  }

  // Find all template variables
  const variablePattern = /\{\{(\s*[\w]+\s*)\}\}/g;
  let match;
  const foundVariables = new Set<string>();
  
  while ((match = variablePattern.exec(template)) !== null) {
    const variable = match[1].trim();
    foundVariables.add(variable);
    if (!validVariables.includes(variable)) {
      errors.push(`Invalid template variable: {{${variable}}}. Valid variables are: ${validVariables.join(', ')}`);
    }
  }

  // Check for potentially dangerous patterns
  if (/<script/i.test(template)) {
    errors.push('Script tags are not allowed in email templates for security reasons');
  }
  
  if (/javascript:/i.test(template)) {
    errors.push('JavaScript protocol is not allowed in email templates');
  }
  
  if (/on\w+\s*=/i.test(template)) {
    errors.push('Event handlers (onclick, onload, etc.) are not allowed in email templates');
  }

  // Dangerous tags that shouldn't be in emails
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'meta', 'link'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b`, 'i');
    if (regex.test(template)) {
      errors.push(`<${tag}> tags are not allowed in email templates`);
    }
  });

  // Warn about missing common variables (just warnings, not errors)
  const commonVariables = ['websiteName', 'websiteUrl', 'viewChangesUrl'];
  commonVariables.forEach(variable => {
    if (!foundVariables.has(variable)) {
      // This is just a warning, not an error
      console.warn(`Template doesn't include {{${variable}}} - consider adding it for better emails`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}