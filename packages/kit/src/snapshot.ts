import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { isIgnored } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { globby } from 'globby'
import _consola from 'consola'
import type { TarFileInput } from 'nanotar'
import { hash, murmurHash, objectHash } from 'ohash'

type HashSource = { name: string, data: any }
type Hashes = { hash: string, sources: HashSource[] }

async function getHashes (nuxt: Nuxt): Promise<Hashes> {
  if ((nuxt as any)._buildHash) {
    return (nuxt as any)._buildHash
  }

  const hashSources: HashSource[] = []

  // Layers
  let layerCtr = 0
  for (const layer of nuxt.options._layers) {
    if (layer.cwd.includes('node_modules')) {
      continue
    }
    const layerName = `layer#${layerCtr++}`
    hashSources.push({
      name: `${layerName}:config`,
      data: objectHash(layer.config),
    })

    const normalizeFiles = (
      files: Awaited<ReturnType<typeof readFilesRecursive>>,
    ) =>
      files.map(f => ({
        name: f.name,
        size: (f.attrs as any)?.size,
        data: murmurHash(f.data as any /* ArrayBuffer */),
      }))

    const sourceFiles = await readFilesRecursive(layer.config?.srcDir, {
      shouldIgnore: isIgnored, // TODO: Validate if works with absolute paths
      patterns: [
        ...Object.values({
          ...nuxt.options.dir,
          ...layer.config.dir,
        }).map(dir => `${dir}/**`),
        'app.{vue,js,ts,cjs,mjs}',
        'App.{vue,js,ts,cjs,mjs}',
      ],
    })

    hashSources.push({
      name: `${layerName}:src`,
      data: normalizeFiles(sourceFiles),
    })

    const rootFiles = await readFilesRecursive(
      layer.config?.rootDir || layer.cwd,
      {
        shouldIgnore: isIgnored, // TODO: Validate if works with absolute paths
        patterns: [
          '.nuxtrc',
          '.npmrc',
          'package.json',
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml',
          'tsconfig.json',
          'bun.lockb',
        ],
      },
    )

    hashSources.push({
      name: `${layerName}:root`,
      data: normalizeFiles(rootFiles),
    })
  }

  const res = ((nuxt as any)._buildHash = {
    hash: hash(hashSources),
    sources: hashSources,
  })

  return res
}

async function getCacheStore (nuxt: Nuxt) {
  const hashes = await getHashes(nuxt)
}
type FileWithMeta = TarFileInput

async function readFilesRecursive (
  dir: string | string[],
  opts: {
    shouldIgnore?: (name: string) => boolean
    noData?: boolean
    patterns?: string[]
  } = {},
): Promise<TarFileInput[]> {
  if (Array.isArray(dir)) {
    return (
      await Promise.all(dir.map(d => readFilesRecursive(d, opts)))
    ).flat()
  }

  const files = await globby(
    [...(opts.patterns || ['**/*']), '!node_modules/**'],
    {
      cwd: dir,
    },
  )

  const fileEntries = await Promise.all(
    files.map(async (fileName) => {
      if (opts.shouldIgnore?.(fileName)) {
        return
      }
      return readFileWithMeta(dir, fileName, opts.noData)
    }),
  )

  return fileEntries.filter(Boolean) as FileWithMeta[]
}

async function readFileWithMeta (
  dir: string,
  fileName: string,
  noData?: boolean,
): Promise<FileWithMeta | undefined> {
  try {
    const filePath = resolve(dir, fileName)

    const stats = await stat(filePath)
    if (!stats?.isFile()) {
      return
    }

    return <FileWithMeta>{
      name: fileName,
      data: noData ? undefined : await readFile(filePath),
      attrs: {
        mtime: stats.mtime.getTime(),
        size: stats.size,
      },
    }
  } catch (err) {
    console.warn(
      `[nuxt-build-cache] Failed to read file \`${fileName}\`:`,
      err,
    )
  }
}
