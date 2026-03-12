export function validateTestCode(code: string): string[] {
  const warnings: string[] = [];

  if (!code.includes('expect(') && !code.includes('toHaveScreenshot')) {
    warnings.push('No assertions found');
  }

  if (!code.includes('test.describe')) {
    warnings.push('Missing test.describe block');
  }

  const waitCount = (code.match(/waitForTimeout/g) || []).length;
  if (waitCount > 5) {
    warnings.push(
      `${waitCount} waitForTimeout calls -- consider using proper waitFor conditions`,
    );
  }

  if (code.includes('TODO:')) {
    warnings.push('Test contains TODO comments');
  }

  if (!code.includes('afterAll') && !code.includes('afterEach')) {
    warnings.push('No cleanup (afterAll/afterEach) found');
  }

  if (!code.includes('toHaveScreenshot')) {
    warnings.push('No visual regression screenshot assertion');
  }

  return warnings;
}
