a fully typed lightweight, highly configurable, resumeable javascript S3 uploader

##### an uploader that just works!

<img alt="multipart-uploader-logo" src="https://github.com/user-attachments/assets/7918ceb9-c6aa-4875-975d-ef5eef4d1ead" width="500"/>

- 🇹🇸 Fully typed
- 🪶 Lightweight – only dependency is the aws s3 sdk
- ⚡ Resume-able and fast. Supports up to **5TB** files!
- 🔒 Secure
- 🗂 Modular imports (client/server/shared)
- 🎛 Independent of context
  - client can be imported in any JS context (vanilla/react/vue/etc.)
  - server can be imported in any existing REST-supporting backend service

### Design Philosophy

- Leave integration decisions to the package user. The package is designed to be flexible, importable into any existing JS ecosystem.
- No UI – simply listen to the emitted events for any custom integration into your existing UI.
- Fully typed and all types are importable.
- The exports are all Classes, so uploaders can be instantiated and managed independently in the (unlikely) case you need multiples with separate options
- Support the [JSR](https://jsr.io/) ecosystem by releasing the package there (JSR does not replace npm, and is backwards compatible)

### Installation

#### NPM

```
npm i @tyler-g/multipart-uploader
```

#### JSR

```
npx jsr add @tyler-g/multipart-uploader
```

#### Deno

```
deno add jsr:@tyler-g/multipart-uploader
```

### Client Integration

#### Basic Usage

```javascript
import { MultipartUploader } from '@tyler-g/multipart-uploader/client'

const myUploader = new MultipartUploader({
  serverConfig: {
    endpoint: 'https://my-super-backend-endpoint.com' // Required: the backend REST endpoint where the server-side integration exists. Don't include ending forward slash
  }
});

myUploader.on('totalProgress', (progress: NumberPercentageRange) => {
  console.log('The total upload % progress (0-100)', progress);
})
myUploader.on('uploadComplete', (s3Filename: string) => {
  console.log('After an upload has completed (is now in S3)', s3Filename);
})
myUploader.on('uploadFailed', (err: Error, localRecord: LocalUploadRecord) => {
  console.log('After an upload has failed for any reason. Passes an error and localRecord of the upload (if exists)', err, localRecord);
})
myUploader.on('error', (err: Error) => {
  console.log('For general error communication to client context', err);
})

// Example file dialog handler function
function handleFile(e) {
  const file: File = e.target.files[0]; // Get the first selected file
  myUploader.uploadMultipart(file);
}

// That's it!
```

#### Usage with Full Options

```javascript
import { MultipartUploader } from '@tyler-g/multipart-uploader/client'
import type { MultipartUploaderOptions, LocalUploadRecord } from '@tyler-g/multipart-uploader/client';

const myUploader = new MultipartUploader({
  serverConfig: {
    endpoint: 'https://my-super-backend-endpoint.com' // Required: the backend REST endpoint where the server-side integration exists. Don't include ending forward slash
    namespace: 'multipart' // optional – the  namespace to use on your endpoint where the routes exist. Defaults to 'multipart'
    headers: {} // optional – use to pass auth Bearer tokens or any headers your server might require on REST requests. Defaults to {}
  },
  concurrencyLimit: 6, // optional – the maximum number of concurrent requests during uploads. Defaults to 6
  partMinSizeBytes: 10 * 1024 * 1024, // optional – the minimum part size in bytes for an upload. Defaults to 10MB
  maxNumParts: 96, // optional – the maximum number of parts for an upload. Defaults to 96
  debugMode: false // optional –  with debug mode on, you will get more informational console logs. Defaults to false
});

// myUploader.id contains the randomly generated id for this instance of MultipartUploader

// Use as many or as few hooks as you'd like to integrate into your UI
myUploader.on('init', (options: MultipartUploaderOptions) => {
  console.log('init event received!', options);
})
myUploader.on('uploadStarted', () => {
  console.log('After an upload is just started (progress 0), but no calls to backend have yet occurred');
})
myUploader.on('uploadResumed', (progress: NumberPercentageRange, localRecord: LocalUploadRecord) => {
  console.log('After an upload is resumed from a previously unfinished upload, but no calls to backend have yet occurred. Passes the localRecord of the upload and the upload percentage of the resume');
})
myUploader.on('uploadCreated', (uploadId: string, s3Filename: string) => {
  console.log('After an upload is created, and an UploadId from AWS has been received');
})
myUploader.on('uploadPartStarted', (partNumber: number) => {
  console.log('After a specific upload part is about to attempt', partNumber);
})
myUploader.on('uploadPartSignedUrl', (partNumber: number, signedUrl: string) => {
  console.log('After a specific upload part has received its signed URL from AWS', partNumber, signedUrl);
})
myUploader.on('uploadPartSuccess', (partNumber: number) => {
  console.log('After a specific upload part has uploaded to S3 and received a 200-level response', partNumber);
})
myUploader.on('totalProgress', (progress: NumberPercentageRange) => {
  console.log('The total upload % progress (0-100)', progress);
})
myUploader.on('uploadComplete', (s3Filename: string) => {
  console.log('After an upload has completed (is now in S3)', s3Filename);
})
myUploader.on('uploadFailed', (err: Error, localRecord: LocalUploadRecord) => {
  console.log('After an upload has failed for any reason. Passes an error and localRecord of the upload (if exists)', err, localRecord);
})
myUploader.on('error', (err: Error) => {
  console.log('For general error communication to client context', err);
})

// Example file dialog handler function
function handleFile(e) {
  const file: File = e.target.files[0]; // Get the first selected file
  myUploader.uploadMultipart(file, {
    originalFilename: file.name
    /*
      ... any other metadata you want to exist on the uploaded S3 file (as header metadata)
    */
  });
}

// That's it!
```

For framework integrations such as React or Vue, see [JS Framework Client Integration](https://github.com/tyler-g/multipart-uploader/wiki/JS-Framework-Client-Integration) in the wiki.

### Backend Integration

The backend is meant to integrate into any existing REST-based backend service. Simply add the routes.
Here's a sample integrated with an `Express` based server backend:

```javascript
import express, { Request, Response } from 'express';
import cors from 'cors';
import { MultipartUploaderBackend } from '@tyler-g/multipart-uploader/server';

const app = express();
app.use(cors());
app.use(express.json());

const uploaderBackend = new MultipartUploaderBackend({
  awsConfig: {
    bucket: 'my-s3-bucket', // Required: replace with your AWS S3 bucket
    signedUrlExpiration: 180, // optional – expiration time in seconds of generated presigned URLs. Defaults to 180 (3 minutes)
    s3Config: {
      region: 'us-east-1' // optional – replace with your AWS region. Defaults to 'us-east-1'
      /*
        ... any other options supported by S3ClientConfig type
      */
    }
  },
  filenameGeneratorFn: null, // optional –  string-returning function reference for filename generation. Defaults to null (filename internally handled, unique UUID generated)
  debugMode: false // optional – debugMode will log additional logs in console. Defaults to false
});

/*
  The reason the routes are split up into separate calls is to facilitate better Typescript integration into your project.
  For example, `req.body` can be cast-typed to the respective request body types for the each of the three routes.
*/
app.post('/multipart/create', async (req: Request, res: Response) => {
  try {
    const result = await uploaderBackend.createMultipartUpload({});
    console.log('createMultipartUpload', result);
    res.json(result);
  } catch (err) {
    console.error('createMultipartUpload err', err);
    res.status(500).send('bad');
  }
});

app.post('/multipart/part', async (req: Request, res: Response) => {
  try {
    const result = await uploaderBackend.uploadMultipartPart(req.body);
    console.log('uploadMultipartPart', result);
    res.json(result);
  } catch (err) {
    console.error('uploadMultipartPart err', err);
    res.status(500).send('bad');
  }
});

app.post('/multipart/complete', async (req: Request, res: Response) => {
  try {
    const result = await uploaderBackend.completeMultipartUpload(req.body);
    console.log('completeMultipartUpload', result);
    res.json(result);
  } catch (err) {
    console.error('completeMultipartUpload err', err);
    res.status(500).send('bad');
  }
});

// Start the server and listen
app.listen(process.env.PORT, () => {
  console.log(`Server is running and listening on port ${process.env.PORT}`);
});

```

#### Unique Filenames

Unique filenames for your uploads are important because if an existing file with the same filename (key) exists in the S3 bucket, it will get overwritten!

Filenames are generated on the backend via a randomUUID from the built-in `crypto` package by default.

_Optionally_, If you wish to generate unique filenames another way, you can pass a string-returning function with the `MultipartUploaderBackend` option `filenameGeneratorFn`:

```javascript
function generateRandomFilename() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  return `file_${timestamp}_${randomString}`;
}
const uploaderBackend = new MultipartUploaderBackend({
  awsConfig: {
    bucket: 'my-s3-bucket' // replace with your AWS S3 bucket,
    s3Config: {
      region: 'us-east-1', // replace with your AWS region
      /*
        ... any other options supported by S3ClientConfig type
      */
    }
  },
  filenameGeneratorFn: generateRandomFilename
});
```

Currently, we don't support passing filenames from the client. The `File`'s filename from the system would not be a good option as an s3 filename (key) because it can't be guaranteed unique. You can however keep the original `File`'s filename by passing it as `metadata` when calling the client `uploadMultipart` method. It will then be accessible as header metadata on the S3 file, gettable via HTTP `HEAD` request.

#### AWS Credentials

The backend package will look in your server environment for AWS credentials. Credentials are usually accessed in the default location of `~/.aws/credentials`

Preferably your integration picks up the credentials from the system environment like this, but if you must pass them in, you can do so in the `s3Config` options of the backend package constructor:

```javascript
const uploaderBackend = new MultipartUploaderBackend({
  awsConfig: {
    bucket: 'my-s3-bucket' // replace with your AWS S3 bucket,
    s3Config: {
      region: 'us-east-1', // replace with your AWS region
      credentials: {
        accessKeyId: 'abc',
        secretAccessKey: 'xyz',
        sessionToken: 'def' // use if your backend is generating session credentials
      }
    }
  },
  /* ... */
});

```

The credentials should be configured to have permission for the following operations on the S3 bucket:

- `s3:PutObject`
- `s3:GetObject`

### Future Goals

- eventually support other storage backends besides S3
- GraphQL support for the server import
