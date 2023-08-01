import fs from 'fs/promises';
import slug from 'slug';
import cliProgress from 'cli-progress';
import colors from 'ansi-colors';
import { execFile as execFileSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
const execFile = promisify(execFileSync);

const VIDEOS_DIR = 'assets/videos/';
const FILES_DIR = 'assets/video-files/';
const CONFIG_FILE = 'assets/videos.json';

function get_subtitle_track_id(output: string): number | null {
  const line = output
    .split('\n')
    .filter(
      line => line.startsWith('Track ID ') && line.includes('subtitles', 11)
    )[0];
  if (!line) return null;
  return line[9] ? parseInt(line[9]) : null;
}

async function clear_folder(dir: string) {
  const files = await fs.readdir(dir);
  if (!files.length) return;

  const bar = new cliProgress.SingleBar({
    format:
      'Clearing Folder |' +
      colors.cyan('{bar}') +
      '| {percentage}% || {value}/{total} Files',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  bar.start(files.length, 0);

  for (const file of files) {
    await fs.unlink(path.join(dir, file));
    bar.increment();
  }

  bar.stop();
}

async function prepare_file_dir() {
  try {
    await fs.mkdir(FILES_DIR);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('EEXIST')) {
      await clear_folder(FILES_DIR);
    } else {
      console.error("Couldn't make files dir");
      console.error(e);
      process.exit(1);
    }
  }
}

async function load_video(name: string) {
  const video_path = path.join(VIDEOS_DIR, name);

  const { stdout, stderr } = await execFile('mkvmerge', [video_path, '-i']);
  if (stderr) {
    console.error("Couldn't read video: " + name);
    console.error(stderr);
    return null;
  }

  const track_id = get_subtitle_track_id(stdout);
  if (track_id === null) {
    console.error("Couldn't get subtitles from video: " + name);
    console.error('Here is the mkvmerge output:');
    console.error(stdout);
    return null;
  }

  const output_file = name.substring(0, name.length - 4) + '.ass';
  const { stderr: extract_err } = await execFile('mkvextract', [
    video_path,
    'tracks',
    `${track_id}:${output_file}`
  ]);
  if (extract_err) {
    console.error("Couldn't extract subtitles from video: " + name);
    console.error(extract_err);
    return null;
  }

  const new_subtitle_path = path.join(FILES_DIR, output_file);
  await fs.rename(output_file, new_subtitle_path).catch(e => {
    console.error("Couldn't move extracted subtitles to files folder");
    console.error(e);
    process.exit(1);
  });

  return {
    name,
    slug: slug(name),
    path: video_path,
    subtitle_path: new_subtitle_path
  };
}

async function main() {
  const paths = await fs.readdir(VIDEOS_DIR);

  await prepare_file_dir();

  const bar = new cliProgress.SingleBar({
    format:
      'Loading Videos |' +
      colors.cyan('{bar}') +
      '| {percentage}% || {value}/{total} Videos',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  bar.start(paths.length, 0);

  const info = [];
  for (const name of paths) {
    const i = await load_video(name);
    if (i) {
      info.push(i);
      bar.increment();
    } else {
      console.error('Failed loading videos');
      process.exit(1);
    }
  }
  bar.stop();

  await fs.writeFile(CONFIG_FILE, JSON.stringify(info, null, 2));
  console.log('Successfully Loaded Videos');
  process.exit(0);
}

main();
