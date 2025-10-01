import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';

import { assetIndex } from './assets-index';

const publicArtDir = path.resolve('packages', 'client', 'public', 'art');
const originalArtDir = path.resolve('assets_1', 'art');

export const artRouter = Router();

artRouter.get('/*', (req: Request, res: Response, next: NextFunction) => {
  const requestedPath = req.params[0] ?? '';
  const safeRelativePath = toSafeRelativePath(requestedPath);
  if (!safeRelativePath) {
    res.status(400).json({ error: 'INVALID_PATH' });
    return;
  }

  const publicCandidate = path.join(publicArtDir, safeRelativePath);
  if (isFile(publicCandidate)) {
    res.sendFile(publicCandidate);
    return;
  }

  const originalCandidate = path.join(originalArtDir, safeRelativePath);
  if (isFile(originalCandidate)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const stream = fs.createReadStream(originalCandidate);
    stream.on('open', () => {
      stream.pipe(res);
    });
    stream.on('error', (err) => {
      next(err);
    });
    return;
  }

  const resolvedAsset = resolveImportedAsset(safeRelativePath);
  if (resolvedAsset) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(resolvedAsset);
    return;
  }

  res.sendStatus(404);
});

function resolveImportedAsset(relativePath: string): string | null {
  const normalized = path.posix.normalize(relativePath).replace(/^\/+/, '');
  const match = normalized.match(/^(?<art>.+?)\/dir_(?<dir>\d+)\/frame_(?<frame>\d+)\.png$/i);
  if (!match || !match.groups) {
    return null;
  }

  const art = match.groups.art;
  const dir = Number.parseInt(match.groups.dir ?? '0', 10);
  const frame = Number.parseInt(match.groups.frame ?? '0', 10);

  return assetIndex.resolveFramePath(art, dir, frame);
}

function toSafeRelativePath(requested: string): string | null {
  if (!requested) {
    return null;
  }
  const normalized = path.posix.normalize(requested).replace(/^\/+/, '');
  if (normalized.includes('..')) {
    return null;
  }
  return normalized;
}

function isFile(candidate: string): boolean {
  try {
    const stat = fs.statSync(candidate);
    return stat.isFile();
  } catch (error) {
    return false;
  }
}
