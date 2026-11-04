import { expect, test, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { linkFor } from './helpers.js';

// F1-20: the critical flow of the product in one go, as an archer lives it — sign up, equipment,
// setup, five marks, intermediates, the Doctor, the printed list — once in Spanish and metres and
// once in English and yards (the browser's language decides both, as for a real new archer).

type Lang = {
  name: string;
  browser: string;
  unit: string;
  sep: string;
  text: {
    email: string;
    username: string;
    password: string;
    repeat: string;
    createAccount: string;
    checkEmail: string;
    verified: string;
    goHome: string;
    guide: string;
    addBow: string;
    manufacturer: string;
    model: string;
    addSight: string;
    minimum: string;
    maximum: string;
    step: string;
    addArrows: string;
    shortName: string;
    createSetup: string;
    save: string;
    addMark: string;
    distance: string;
    reading: string;
    pickMark: (d: number) => string;
    summary: string;
    intermediates: string;
    distancesTitle: string;
    lookUp: string;
    back: RegExp;
    doctor: string;
    doctorTitle: string;
    reshoot: RegExp;
    print: string;
    printTitle: string;
    sheet: string;
  };
};

const LANGS: Lang[] = [
  {
    name: 'Spanish and metres',
    browser: 'es-AR',
    unit: 'm',
    sep: ',',
    text: {
      email: 'Email',
      username: 'Usuario',
      password: 'Contraseña',
      repeat: 'Repetí la contraseña',
      createAccount: 'Crear cuenta',
      checkEmail: 'Revisá tu correo',
      verified: 'Email verificado',
      goHome: 'Ir al inicio',
      guide: 'Tu primer setup en 4 pasos',
      addBow: 'Cargar arco',
      manufacturer: 'Fabricante',
      model: 'Modelo',
      addSight: 'Cargar mira',
      minimum: 'Mínimo',
      maximum: 'Máximo',
      step: 'Paso más chico',
      addArrows: 'Cargar flechas',
      shortName: 'Nombre corto',
      createSetup: 'Crear setup',
      save: 'Guardar',
      addMark: '+ Agregar marca',
      distance: 'Distancia',
      reading: 'Lectura',
      pickMark: (d) => `Elegir la marca de ${d} m`,
      summary: 'Marcas: 5 · 20–60 m',
      intermediates: 'Intermedias',
      distancesTitle: 'Distancias',
      lookUp: 'Ver lectura',
      back: /La mira/,
      doctor: 'Doctor',
      doctorTitle: 'Mark Doctor',
      reshoot: /^Volvé a tirar 40 m: se aparta/,
      print: 'Imprimir',
      printTitle: 'Listado imprimible',
      sheet: 'Marcas de mira',
    },
  },
  {
    name: 'English and yards',
    browser: 'en-US',
    unit: 'yd',
    sep: '.',
    text: {
      email: 'Email',
      username: 'Username',
      password: 'Password',
      repeat: 'Repeat the password',
      createAccount: 'Create account',
      checkEmail: 'Check your email',
      verified: 'Email verified',
      goHome: 'Go home',
      guide: 'Your first setup in 4 steps',
      addBow: 'Add bow',
      manufacturer: 'Manufacturer',
      model: 'Model',
      addSight: 'Add sight',
      minimum: 'Minimum',
      maximum: 'Maximum',
      step: 'Smallest step',
      addArrows: 'Add arrows',
      shortName: 'Short name',
      createSetup: 'Create setup',
      save: 'Save',
      addMark: '+ Add sight mark',
      distance: 'Distance',
      reading: 'Reading',
      pickMark: (d) => `Pick the mark at ${d} yd`,
      summary: 'Marks: 5 · 20–60 yd',
      intermediates: 'Intermediates',
      distancesTitle: 'Distances',
      lookUp: 'Get reading',
      back: /The sight/,
      doctor: 'Doctor',
      doctorTitle: 'Mark Doctor',
      reshoot: /^Re-shoot 40 yd: it is/,
      print: 'Print',
      printTitle: 'Printable list',
      sheet: 'Sight marks',
    },
  },
];

async function signUp(page: Page, l: Lang) {
  const id = randomBytes(4).toString('hex');
  const email = `flow-${id}@example.com`;
  const password = randomBytes(12).toString('hex');
  const t = l.text;
  await page.goto('/sign-up');
  await page.getByLabel(t.email, { exact: true }).fill(email);
  await page.getByLabel(t.username).fill(`flow${id}`);
  await page.getByLabel(t.password, { exact: true }).fill(password);
  await page.getByLabel(t.repeat).fill(password);
  await page.getByRole('button', { name: t.createAccount }).click();
  await expect(page.getByRole('heading', { name: t.checkEmail })).toBeVisible();
  await page.goto(await linkFor(email));
  await expect(page.getByRole('heading', { name: t.verified })).toBeVisible();
  await page.getByRole('link', { name: t.goHome }).click();
}

for (const l of LANGS) {
  test.describe(l.name, () => {
    test.use({ locale: l.browser });

    test('sign up → equipment → setup → 5 marks → intermediates → Doctor → printed list', async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const t = l.text;
      const n = (value: string) => value.replace('.', l.sep);

      // Sign up: the profile is born in the browser's language and its units.
      await signUp(page, l);
      await expect(page.getByRole('heading', { name: t.guide })).toBeVisible();

      // Equipment, through the guide.
      await page.getByRole('link', { name: t.addBow }).click();
      await page.getByLabel(t.manufacturer).fill('Hoyt');
      await page.getByLabel(t.model).fill('Alpha');
      await page.getByRole('button', { name: t.save }).click();
      await page.getByRole('link', { name: t.addSight }).click();
      await page.getByLabel(t.model).fill('Ultraview');
      await page.getByLabel(t.minimum).fill('0');
      await page.getByLabel(t.maximum).fill('10');
      await page.getByLabel(t.step).fill(n('0.1'));
      await page.getByRole('button', { name: t.save }).click();
      await page.getByRole('link', { name: t.addArrows }).click();
      await page.getByLabel(t.shortName).fill('Hunter 400');
      await page.getByRole('button', { name: t.save }).click();

      // The setup: what was loaded comes chosen.
      await page.getByRole('link', { name: t.createSetup }).click();
      await page.getByRole('button', { name: t.save }).click();

      // Five marks, the author's set, with 40 written 0.8 off so the Doctor has work.
      for (const [distance, reading] of [
        [20, '0.3'],
        [30, '0.8'],
        [40, '2.4'],
        [50, '2.6'],
        [60, '3.6'],
      ] as const) {
        await page.getByRole('button', { name: t.addMark }).click();
        await page.getByLabel(t.distance, { exact: true }).fill(String(distance));
        await page.getByLabel(t.reading, { exact: true }).fill(n(reading));
        await page.getByRole('button', { name: t.save }).click();
        await expect(page.getByRole('button', { name: t.pickMark(distance) })).toBeVisible();
      }
      await expect(page.getByText(t.summary)).toBeVisible();

      // Intermediates: the grid in the archer's unit, measured plain and the rest estimated.
      await page.getByRole('link', { name: t.intermediates }).click();
      await expect(page.getByRole('heading', { name: t.distancesTitle, level: 1 })).toBeVisible();
      await expect(page.getByRole('row').filter({ hasText: `25 ${l.unit}` })).toContainText('≈');
      await expect(page.getByRole('row').filter({ hasText: `30 ${l.unit}` })).not.toContainText(
        '≈',
      );
      await page.getByLabel(t.distance, { exact: true }).fill('45');
      await page.getByRole('button', { name: t.lookUp }).click();
      await expect(page.getByText(new RegExp(`^45 ${l.unit}`)).first()).toContainText('≈');

      // The Doctor points at 40 and says how far it is off.
      await page.getByRole('link', { name: t.back }).click();
      await page.getByRole('link', { name: t.doctor }).click();
      await expect(page.getByRole('heading', { name: t.doctorTitle, level: 1 })).toBeVisible();
      await expect(page.getByText(t.reshoot)).toBeVisible();

      // The printed list: only the sheet on paper, one page.
      await page.getByRole('link', { name: t.back }).click();
      await page.getByRole('link', { name: t.print }).click();
      await expect(page.getByRole('heading', { name: t.printTitle, level: 1 })).toBeVisible();
      const sheet = page.getByRole('article', { name: t.sheet });
      await expect(sheet.getByRole('row')).toHaveCount(10); // header + 20, 25 … 60
      await expect(sheet).toContainText(`60 ${l.unit}`);
      await expect(sheet).toContainText(n('3.6'));
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('header')).toBeHidden();
      await expect(sheet).toBeVisible();
      const pdf = await page.pdf({ format: 'A4' });
      expect((pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length).toBe(1);
    });
  });
}
