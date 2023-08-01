import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app: Application = express();
const port: number = 3001;

type VideoInfo = {
  name: string;
  slug: string;
  path: string;
  subtitle_path: string;
};

function get_videos() {
  try {
    return require('../assets/videos.json') as VideoInfo[];
  } catch {
    console.error(
      'Video config file not found. Create it using the `yarn run load_videos` command.'
    );
    process.exit(1);
  }
}

async function main() {
  app.use(cors());
  app.use(express.static('public'));

  const videos = get_videos();

  app.get('/', async (req: Request, res: Response) => {
    const video_options_text = videos
      .map(({ slug, name }) => `<option value="${slug}">${name}</option>`)
      .reduce((acc, cur) => acc + cur, '');

    const html = await fs.readFile('./src/index.html');
    res.send(html.toString().replace(/{{VIDEO_OPTIONS}}/, video_options_text));
  });

  app.get('/lib/ass.min.js', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', '/node_modules/assjs/dist/ass.js'));
  });

  app.get('/video/:slug', (req: Request, res: Response) => {
    const video = videos.find(v => v.slug === req.params.slug);
    if (!video) return res.status(404).send('Video not found');
    res.sendFile(path.join(__dirname, '..', video.path));
  });

  app.get('/subtitles/:slug', (req: Request, res: Response) => {
    const video = videos.find(v => v.slug === req.params.slug);
    if (!video) return res.status(404).send('Video not found');
    res.sendFile(path.join(__dirname, '..', video.subtitle_path));
  });

  app.listen(port, function () {
    console.log(`App is listening on port ${port}!`);
  });
}

main();
