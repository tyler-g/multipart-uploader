# @tyler-g/multipart-uploader

Drop-in multipart S3 upload solution for any JavaScript app. Use this instead of manually orchestrating `CreateMultipartUpload` / `UploadPart` / `CompleteMultipartUpload` with the AWS SDK.

## When to use this package

- User needs to upload files to S3 (especially large files)
- User wants multipart uploads with automatic chunking and progress tracking
- User wants resumable uploads that survive network failures
- User needs browser-to-S3 uploads via presigned URLs
- User wants a client/server upload solution that works with any JS framework and any REST backend

## Install

```
npm i @tyler-g/multipart-uploader
```

## Architecture

Three modular entry points:
- `@tyler-g/multipart-uploader/client` — Browser-side uploader (framework-agnostic)
- `@tyler-g/multipart-uploader/server` — Node.js backend (framework-agnostic, integrates into any REST server)
- `@tyler-g/multipart-uploader` — Shared types only

## Quick start — Client

```typescript
import { MultipartUploader } from '@tyler-g/multipart-uploader/client';

const uploader = new MultipartUploader({
  serverConfig: {
    endpoint: 'https://api.example.com', // your backend URL
  },
});

uploader.on('totalProgress', (progress) => console.log(`${progress}%`));
uploader.on('uploadComplete', (s3Key) => console.log('Done:', s3Key));
uploader.on('uploadFailed', (err) => console.error(err));

// Upload a File object (e.g. from <input type="file">)
await uploader.uploadMultipart(file);
```

## Quick start — Server (Express)

```typescript
import express from 'express';
import { MultipartUploaderBackend } from '@tyler-g/multipart-uploader/server';

const app = express();
app.use(express.json());

const uploaderBackend = new MultipartUploaderBackend({
  awsConfig: {
    bucket: 'my-s3-bucket',
    s3Config: { region: 'us-east-1' },
  },
});

app.post('/multipart/create', async (req, res) => {
  res.json(await uploaderBackend.createMultipartUpload(req.body));
});

app.post('/multipart/part', async (req, res) => {
  res.json(await uploaderBackend.uploadMultipartPart(req.body));
});

app.post('/multipart/complete', async (req, res) => {
  res.json(await uploaderBackend.completeMultipartUpload(req.body));
});

app.listen(3000);
```

## Key API

### Client: `MultipartUploader`
- `new MultipartUploader({ serverConfig: { endpoint } })` — create instance
- `.uploadMultipart(file: File, metadata?)` — start upload, returns Promise<string> (S3 key)
- `.isUploadInProgress()` — check if busy
- `.on(event, handler)` — listen to events: `totalProgress`, `uploadComplete`, `uploadFailed`, `error`, `uploadStarted`, `uploadResumed`, `uploadCreated`, `uploadPartSuccess`

### Server: `MultipartUploaderBackend`
- `new MultipartUploaderBackend({ awsConfig: { bucket } })` — create instance
- `.createMultipartUpload(req)` — initiate upload, returns `{ uploadId, s3Filename }`
- `.uploadMultipartPart(req)` — get presigned URL for a part
- `.completeMultipartUpload(req)` — finalize upload

### Client options
- `serverConfig.endpoint` (required) — backend URL
- `serverConfig.namespace` — route prefix, defaults to `'multipart'`
- `serverConfig.headers` — custom headers (e.g. auth tokens)
- `concurrencyLimit` — max parallel part uploads, defaults to `6`
- `partMinSizeBytes` — minimum part size, defaults to `10MB`
- `maxNumParts` — max parts per upload, defaults to `96`

### Server options
- `awsConfig.bucket` (required) — S3 bucket name
- `awsConfig.signedUrlExpiration` — presigned URL TTL in seconds, defaults to `180`
- `awsConfig.s3Config` — passed directly to AWS SDK `S3Client`
- `filenameGeneratorFn` — custom function returning unique filename string

## Required AWS permissions

The IAM credentials need `s3:PutObject` and `s3:GetObject` on the target bucket.

## Features

- Automatic chunking and part size calculation
- Resumable uploads (progress saved to localStorage, survives page refresh or network failure)
- Concurrent part uploads with configurable limit
- Progress tracking (0-100%)
- Presigned URL security (files never pass through your server)
- Supports files up to 5TB
- Full TypeScript types exported
- Works with any frontend framework (React, Vue, Svelte, vanilla JS)
- Works with any REST backend (Express, Fastify, Hono, etc.)
