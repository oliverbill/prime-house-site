// @ts-check
const { test, expect } = require('@playwright/test');

const PAGES = [
  '/index.html',
  '/servicos.html',
  '/perguntas-frequentes.html',
  '/politica-de-privacidade.html',
  '/termos-de-uso.html',
];

// Domínios externos que costumam bloquear/limitar bots e navegadores headless
// (o próprio workflow de validação de HTML do repositório já ignora o Instagram
// pelo mesmo motivo). Para esses, aceitamos qualquer resposta HTTP (mesmo 3xx/4xx
// de bloqueio de bot) desde que o servidor responda algo — não tratamos como link quebrado.
const LENIENT_EXTERNAL_HOSTS = ['instagram.com', 'wa.me'];

function isLenientExternal(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return LENIENT_EXTERNAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** @param {import('@playwright/test').Page} page */
async function collectLinks(page) {
  return page.$$eval('a[href]', (anchors) =>
    anchors.map((a) => ({
      href: a.getAttribute('href') || '',
      text: (a.textContent || '').trim().slice(0, 60),
      target: a.getAttribute('target') || '',
    }))
  );
}

for (const pagePath of PAGES) {
  test.describe(`Links em ${pagePath}`, () => {
    test(`todos os links de ${pagePath} respondem corretamente`, async ({ page, request }) => {
      const response = await page.goto(pagePath);
      expect(response?.ok(), `A própria página ${pagePath} deveria carregar com 2xx`).toBeTruthy();

      const links = await collectLinks(page);
      expect(links.length, `${pagePath} não tem nenhum link <a href> — algo está errado`).toBeGreaterThan(0);

      const internalLinks = [];

      // Passo 1: âncoras, mailto, tel e links externos — tudo verificado sem
      // navegar a página para fora de ${pagePath}, para não invalidar os
      // próximos checks (e os links internos ficam guardados para o passo 2).
      for (const link of links) {
        const { href, text } = link;

        if (!href || href === '#') continue;

        if (href.startsWith('#')) {
          const anchorId = href.slice(1);
          const target = page.locator(`[id="${anchorId}"]`);
          await expect(target, `Âncora "${href}" (link "${text}") não existe em ${pagePath}`).toHaveCount(1);
          continue;
        }

        if (href.startsWith('mailto:')) {
          expect(href, `Link mailto inválido: ${href}`).toMatch(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/);
          continue;
        }

        if (href.startsWith('tel:')) {
          expect(href, `Link tel inválido: ${href}`).toMatch(/^tel:\+?[0-9]{8,15}$/);
          continue;
        }

        if (href.startsWith('http://') || href.startsWith('https://')) {
          // Link externo: verificamos a resposta HTTP real, sem navegar o browser para fora do site.
          let status = null;
          try {
            const res = await request.fetch(href, { method: 'GET', maxRedirects: 5, timeout: 15000 });
            status = res.status();
          } catch (err) {
            if (isLenientExternal(href)) continue;
            throw new Error(`Link externo "${href}" (texto "${text}") falhou ao responder: ${err}`);
          }
          if (isLenientExternal(href)) continue;
          expect(status, `Link externo "${href}" (texto "${text}") respondeu ${status}`).toBeLessThan(400);
          continue;
        }

        internalLinks.push(link);
      }

      // Passo 2: links internos relativos (ex.: servicos.html, ../index.html) —
      // clicamos de verdade e confirmamos que a navegação carrega a página.
      for (const link of internalLinks) {
        const { href, text } = link;

        await page.goto(pagePath);
        const locator = page.locator(`a[href="${href}"]`).first();
        await expect(locator, `Link interno "${href}" (texto "${text}") não encontrado para clicar em ${pagePath}`).toBeVisible();

        const [navResponse] = await Promise.all([
          page.waitForNavigation({ waitUntil: 'load' }),
          locator.click(),
        ]);
        expect(
          navResponse?.ok(),
          `Clicar em "${text}" (${href}) a partir de ${pagePath} não carregou a página corretamente (status ${navResponse?.status()})`
        ).toBeTruthy();
      }
    });
  });
}

test.describe('Menu mobile', () => {
  for (const pagePath of PAGES) {
    test(`abre, mostra os links e navega corretamente em ${pagePath}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(pagePath);

      const hasMobileMenu = await page.locator('.mobile-menu').count();
      test.skip(hasMobileMenu === 0, `${pagePath} não tem menu mobile (.mobile-menu) — layout de página secundária sem esse componente`);

      const menuButton = page.locator('.mobile-menu button');
      const panel = page.locator('.mobile-menu-panel');

      await expect(menuButton).toBeVisible();
      await expect(panel).toBeHidden();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

      await menuButton.click();
      await expect(panel).toBeVisible();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

      const panelLinks = await panel.locator('a[href]').all();
      expect(panelLinks.length, `Painel do menu mobile em ${pagePath} não tem nenhum link`).toBeGreaterThan(0);

      // Clica no primeiro link interno (não target=_blank) do menu para confirmar que navega.
      let clicked = false;
      for (const link of panelLinks) {
        const target = await link.getAttribute('target');
        const href = await link.getAttribute('href');
        if (target === '_blank' || !href || href.startsWith('#') || href.startsWith('http')) continue;

        const [navResponse] = await Promise.all([
          page.waitForNavigation({ waitUntil: 'load' }),
          link.click(),
        ]);
        expect(
          navResponse?.ok(),
          `Clicar em um link do menu mobile em ${pagePath} (href "${href}") não navegou corretamente`
        ).toBeTruthy();
        clicked = true;
        break;
      }
      expect(clicked, `Nenhum link interno clicável foi encontrado no menu mobile de ${pagePath}`).toBeTruthy();
    });
  }
});
