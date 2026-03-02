export default async function handler(req: any, res: any) {
  const txt = `User-agent: *
Allow: /

Sitemap: https://smart-student-platform-21.vercel.app/sitemap.xml`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
  res.status(200).send(txt);
}
