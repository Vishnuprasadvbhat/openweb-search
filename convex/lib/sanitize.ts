// Simple HTML sanitization for Convex runtime
// Note: DOMPurify doesn't work in Convex, so we use a simple regex-based approach

// Basic HTML entity encoding for safety
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  
  return text.replace(/[&<>"'\/]/g, (char) => htmlEntities[char] || char);
}

// Simple HTML sanitization
export function sanitizeHtml(html: string): string {
  // First, escape all HTML to prevent XSS
  let safe = html;
  
  // Remove script tags and their contents
  safe = safe.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onload, etc.)
  safe = safe.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  safe = safe.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  safe = safe.replace(/javascript:/gi, '');
  
  // Remove data: URLs in src/href (potential security risk)
  safe = safe.replace(/\s(src|href)\s*=\s*["']?\s*data:[^"'\s>]*/gi, ' $1=""');
  
  // Remove potentially dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'meta', 'link'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>.*?</${tag}>|<${tag}\\b[^>]*/>|<${tag}\\b[^>]*>`, 'gi');
    safe = safe.replace(regex, '');
  });
  
  return safe;
}

// Validate that template variables are properly formatted
export function validateTemplateVariables(template: string): { isValid: boolean; errors: string[] } {
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

  // Find all template variables
  const variablePattern = /\{\{(\s*[\w]+\s*)\}\}/g;
  let match;
  
  while ((match = variablePattern.exec(template)) !== null) {
    const variable = match[1].trim();
    if (!validVariables.includes(variable)) {
      errors.push(`Invalid template variable: {{${variable}}}`);
    }
  }

  // Check for potentially dangerous patterns
  if (/<script/i.test(template)) {
    errors.push('Script tags are not allowed in templates');
  }
  
  if (/javascript:/i.test(template)) {
    errors.push('JavaScript protocol is not allowed');
  }
  
  if (/on\w+\s*=/i.test(template)) {
    errors.push('Event handlers (onclick, etc.) are not allowed');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}