import { expect, test } from '@playwright/test';
import { simularApi } from './mocks';

const capturas = 'e2e/capturas';

test('flujo completo: buscar → guardar → analizar → borradores → leads → CSV → radar', async ({ page }) => {
  await simularApi(page);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  await page.goto('/buscar');
  await expect(page.getByText(/Falta la clave de Gemini y Google Cloud/)).toBeVisible();
  await page.getByRole('link', { name: 'Pégala en Ajustes' }).click();
  await page.getByLabel('Clave de Gemini').fill('mala');
  await page.getByRole('button', { name: 'Probar' }).first().click();
  await expect(page.getByText(/API key not valid/)).toBeVisible();
  await page.getByLabel('Clave de Gemini').fill('AIza-gemini-buena');
  await page.getByRole('button', { name: 'Probar' }).first().click();
  await expect(page.getByText('✓ Funciona. Modelo: gemini-2.5-flash')).toBeVisible();
  await page.getByLabel(/Clave de Google Cloud/).fill('AIza-google-buena');
  await page.getByRole('button', { name: 'Probar' }).nth(1).click();
  await expect(page.getByText('✓ Funciona con Places API (New).')).toBeVisible();
  await page.getByPlaceholder('Tu nombre (y empresa, si tienes)').fill('Andrés Delgado');
  await page.screenshot({ path: `${capturas}/0-ajustes.png`, fullPage: true });

  // Buscar
  await page.getByRole('link', { name: 'Buscar' }).click();
  await page.getByPlaceholder(/Ciudad, barrio/).fill('Cuenca, Ecuador');
  await page.getByPlaceholder('p. ej. talleres mecánicos').fill('talleres mecánicos');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('6 negocios')).toBeVisible();
  // Cerrado oculto por defecto
  await expect(page.getByText('mostrando 5')).toBeVisible();
  await expect(page.getByText('Sin web propia').first()).toBeVisible();
  await page.getByRole('button', { name: /Cargar más/ }).click();
  await expect(page.getByText('8 negocios')).toBeVisible();
  await page.screenshot({ path: `${capturas}/1-buscar.png`, fullPage: true });

  // Desglose de la oportunidad
  await page.locator('tbody tr').first().locator('button.nota').click();
  await expect(page.getByText(/¿Por qué \d+\?/)).toBeVisible();
  await page.screenshot({ path: `${capturas}/2-desglose.png` });
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);

  // Filtro solo sin web
  await page.getByLabel('Solo sin web').check();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByLabel('Solo sin web').uncheck();

  // Seleccionar dos y analizar
  await page.getByLabel(/Seleccionar Taller Pérez 1/).check();
  await page.getByLabel(/Seleccionar Taller Andino 2/).check();
  await page.getByRole('button', { name: 'Analizar seleccionados' }).click();
  await expect(page.getByText(/Analizando \d de 2/)).toBeVisible();
  await page.screenshot({ path: `${capturas}/3-cola.png` });
  await expect(page.getByText('Análisis terminado (2)')).toBeVisible({ timeout: 15_000 });

  // Ficha
  await page.getByRole('link', { name: 'Taller Pérez 1' }).first().click();
  await expect(page.getByRole('heading', { name: 'Taller Pérez 1' })).toBeVisible();
  await expect(page.getByText('PageSpeed en móvil')).toBeVisible();
  await expect(page.getByText('Botón de WhatsApp', { exact: true })).toBeVisible();
  await expect(page.getByText('info@tallerperez.com.ec').first()).toBeVisible();
  await page.getByRole('button', { name: 'Redactar borradores' }).click();
  await expect(page.getByText('Guion de llamada (30 s)')).toBeVisible();
  await expect(page.getByText('Borradores para contactar de forma personal. No envíes mensajes comerciales masivos sin consentimiento.')).toBeVisible();
  await page.getByLabel('Tono').selectOption('cercano');
  await page.getByRole('button', { name: 'Regenerar con este tono' }).click();
  await expect(page.getByText('(Tono cercano)')).toBeVisible();
  await page.getByPlaceholder(/Con quién hablaste/).fill('Llamar el lunes, habla con Don Jorge');
  await page.getByLabel('Estado').selectOption('contactado');
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${capturas}/4-ficha.png`, fullPage: true });

  // Versión imprimible
  const [imp] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Exportar ficha' }).click()]);
  await imp.evaluate(() => (window.print = () => {}));
  await expect(imp.getByText('Llamar el lunes, habla con Don Jorge')).toBeVisible();
  await imp.screenshot({ path: `${capturas}/5-imprimir.png`, fullPage: true });
  await imp.close();

  // Ficha sin web
  await page.goto('/negocio/p2');
  await expect(page.getByText('Oportunidad: Sin web.')).toBeVisible();
  await expect(page.getByText('PageSpeed en móvil')).toHaveCount(0);

  // Mis leads
  await page.getByRole('link', { name: 'Mis leads' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
  const csv = await (await descarga.createReadStream()).toArray();
  const texto = Buffer.concat(csv).toString('utf8');
  expect(texto.charCodeAt(0)).toBe(0xfeff);
  expect(texto).toContain('Llamar el lunes');
  await page.getByRole('button', { name: 'Tablero' }).click();
  await page.screenshot({ path: `${capturas}/6-tablero.png`, fullPage: true });

  // Error real de la API
  await page.getByRole('link', { name: 'Buscar' }).click();
  await page.getByPlaceholder(/Ciudad, barrio/).fill('Cuenca, Ecuador');
  await page.getByPlaceholder('p. ej. talleres mecánicos').fill('error');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText(/Places \(403\): Places API \(New\) has not been used/)).toBeVisible();

  // Radar de nichos
  await page.getByRole('link', { name: 'Radar de nichos' }).click();
  await page.getByPlaceholder('p. ej. Cuenca, Ecuador').fill('Cuenca, Ecuador');
  await page.getByRole('button', { name: 'Analizar zona' }).click();
  await expect(page.getByText(/Gastará 13 llamada/)).toBeVisible();
  await page.screenshot({ path: `${capturas}/7-radar-confirmar.png` });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText(/Las tres mejores son/)).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${capturas}/8-radar.png`, fullPage: true });
  await page.getByRole('button', { name: 'Ver negocios' }).first().click();
  await expect(page).toHaveURL(/\/buscar/);
  await expect(page.getByText(/negocios/).first()).toBeVisible();

  // Contador de Places: 2 (buscar + más) + 1 (error) + 13 (radar)
  await page.goto('/ajustes');
  await expect(page.getByText('Places este mes: 16 / 1000')).toBeVisible();

  expect(errores).toEqual([]);
});

test('móvil: tarjetas y menú inferior', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-419' });
  const page = await ctx.newPage();
  await simularApi(page);
  await page.addInitScript(() => localStorage.setItem('radar-ajustes', JSON.stringify({ state: { claveGemini: 'a', claveGoogle: 'b' }, version: 1 })));
  await page.goto('/buscar');
  await page.getByPlaceholder(/Ciudad, barrio/).fill('Cuenca, Ecuador');
  await page.getByPlaceholder('p. ej. talleres mecánicos').fill('talleres mecánicos');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.tarjeta').first()).toBeVisible();
  await page.screenshot({ path: `${capturas}/9-movil.png`, fullPage: true });
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(390);
  await ctx.close();
});
