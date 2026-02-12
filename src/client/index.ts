import EventEmitter from './event-emitter.js';
import type {
  CreateMultipartUploadRequest,
  CreateMultipartUploadResponse,
  UploadMultipartPartRequest,
  UploadMultipartPartResponse,
  CompleteMultipartUploadRequest,
  CompleteMultipartUploadResponse,
  NumberPercentageRange,
  UploadPartResponse,
} from '../shared/index.js';

import {
  promiseFnThrottle,
  getAndParseLS,
  setLS,
  removeLS,
  cleanUpETags,
} from './util.js';
import { deepMerge } from '../shared/util.js';

const ONE_MB_IN_BYTES = 1024 * 1024;

export type ServerOptions = {
  /** Required: the backend REST endpoint where the server-side integration exists. Don't include ending forward slash */
  endpoint: string;
  /** The namespace for the route on the endpoint. Defaults to 'multipart' */
  namespace?: string;
  /** The request headers object to pass on the requests to backend. Can be used for adding auth Bearer tokens or any other headers; defaults to {} */
  headers?: Record<string, any>;
};

export type MultipartUploaderOptions = {
  /** Required: Config for the server calls  */
  serverConfig: ServerOptions;
  /** The maximum number of concurrent requests during uploads; defaults to 6  */
  concurrencyLimit?: number;
  /** The minimum part size in bytes for an upload; defaults to 10MB */
  partMinSizeBytes?: number;
  /** The maximum number of parts for an upload; defaults to 96 */
  maxNumParts?: number;
  /** With debug mode on, you will get more informational console logs; defaults to false */
  debugMode?: boolean;
};

const defaultOptions = {
  serverConfig: {
    endpoint: '',
    namespace: 'multipart',
    headers: {},
  },
  concurrencyLimit: 6,
  partMinSizeBytes: 10 * ONE_MB_IN_BYTES, // 10MB
  maxNumParts: 96,
  debugMode: false,
};

export type MultipartUploaderEvents = {
  /** After MultipartUploader instance is created */
  init: [options: MultipartUploaderOptions];
  /** After an upload is just started (progress 0), but no calls to backend have yet occurred. */
  uploadStarted: [];
  /** After an upload is resumed from a previously unfinished upload, but no calls to backend have yet occurred. Passes the localRecord of the upload and the upload percentage of the resume */
  uploadResumed: [
    progress: NumberPercentageRange,
    localRecord: LocalUploadRecord,
  ];
  /** After an upload is created, and an UploadId from AWS has been received */
  uploadCreated: [uploadId: string, s3Filename: string];
  /** After a specific upload part is about to attempt */
  uploadPartStarted: [partNumber: number];
  /** After a specific upload part has received its signed URL from AWS */
  uploadPartSignedUrl: [partNumber: number, signedUrl: string];
  /** After a specific upload part has uploaded to S3 and received a 200-level response */
  uploadPartSuccess: [partNumber: number];
  /** The total upload % progress (0-100) */
  totalProgress: [progress: NumberPercentageRange];
  /** After an upload has completed */
  uploadComplete: [s3Filename: string];
  /** After an upload has failed for any reason. Passes an error and localRecord of the upload (if exists) */
  uploadFailed: [error: Error, localRecord: LocalUploadRecord];
  /** For general error communication to client context */
  error: [error: Error];
};

export type LocalUploadRecord = {
  /** The filename of the original file */
  originalFilename: string;
  /** The file size of the original file, in bytes */
  totalFileSizeInBytes: number;
  /** The total number of parts calculated for the upload */
  totalParts: number;
  /** The part size calculated for each part of the upload, in bytes*/
  partSizeInBytes: number;
  /** The array of part responses corresponding to each partNumber and its respective ETag response header  */
  finishedParts: UploadPartResponse[] | [];
  /** The uploadId received from the create step when this upload was started */
  uploadId: string;
  /** The AWS S3 filename (key) from the create step when this upload was started */
  s3Filename: string;
};

/** Create a new MultipartUploader instance */
export class MultipartUploader extends EventEmitter<MultipartUploaderEvents> {
  public options: MultipartUploaderOptions & typeof defaultOptions;
  public id: string;
  private partsUploadProgress: Record<number, number> = {};
  private totalUploadProgress: NumberPercentageRange = 0;
  private uploadInProgress = false;

  constructor(options: MultipartUploaderOptions) {
    super();
    this.options = deepMerge({ ...defaultOptions }, options);
    if (this.options.debugMode) {
      console.log('MultipartUploader constructor', this.options);
    }
    if (!this.options.serverConfig.endpoint) {
      throw new Error(
        'endpoint required in the serverConfig constructor options. Not found'
      );
    }
    this.id = crypto.randomUUID();

    // use Promise.resolve to allow the 'init' event to be caught by instances of this class
    Promise.resolve().then(() => {
      this.emit('init', this.options);
    });
  }

  private async uploadMultipartCreate(
    req: CreateMultipartUploadRequest
  ): Promise<CreateMultipartUploadResponse> {
    const fetchOptions = {
      method: 'POST',
      headers: Object.assign(
        {},
        {
          'Content-Type': 'application/json',
        },
        this.options.serverConfig.headers
      ),
      body: JSON.stringify(req),
    };
    const response = await fetch(
      `${this.options.serverConfig.endpoint}/${this.options.serverConfig.namespace}/create`,
      fetchOptions
    );
    const responseJson = await response.json();

    return responseJson;
  }

  private async uploadMultipartPart(
    req: UploadMultipartPartRequest
  ): Promise<UploadMultipartPartResponse> {
    const fetchOptions = {
      method: 'POST',
      headers: Object.assign(
        {},
        {
          'Content-Type': 'application/json',
        },
        this.options.serverConfig.headers
      ),
      body: JSON.stringify(req),
    };
    const response = await fetch(
      `${this.options.serverConfig.endpoint}/${this.options.serverConfig.namespace}/part`,
      fetchOptions
    );
    const responseJson = await response.json();

    return responseJson;
  }

  private async uploadMultipartComplete(
    req: CompleteMultipartUploadRequest
  ): Promise<CompleteMultipartUploadResponse> {
    const fetchOptions = {
      method: 'POST',
      headers: Object.assign(
        {},
        {
          'Content-Type': 'application/json',
        },
        this.options.serverConfig.headers
      ),
      body: JSON.stringify(req),
    };
    const response = await fetch(
      `${this.options.serverConfig.endpoint}/${this.options.serverConfig.namespace}/complete`,
      fetchOptions
    );
    const responseJson = await response.json();

    return responseJson;
  }

  private async uploadPartToS3(
    signedUrl: string,
    blob: Blob,
    partNumber: number,
    totalParts: number,
    fileType: string,
    fileName: string
  ): Promise<UploadPartResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('PUT', signedUrl, true);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;

        const percentCompleted = Math.round((event.loaded * 100) / event.total);
        this.partsUploadProgress[partNumber] = percentCompleted;
        let totalProgress = Object.values(this.partsUploadProgress).reduce(
          (sum: number, progress) => sum + Number(progress),
          0
        ) as NumberPercentageRange;
        totalProgress = Math.floor(
          totalProgress / totalParts
        ) as NumberPercentageRange;

        if (totalProgress > this.totalUploadProgress) {
          this.totalUploadProgress = totalProgress;
          this.emit('totalProgress', totalProgress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let eTag = xhr.getResponseHeader('ETag');
          if (eTag) {
            // Remove any extra quotes from the ETag value
            eTag = eTag.replace(/^"|"$/g, '');
          }
          const response = {
            ETag: eTag,
            PartNumber: partNumber,
          } as UploadPartResponse;
          resolve(response);
          this.emit('uploadPartSuccess', partNumber);
          const localStorageRecord = getAndParseLS(`video|${fileName}`);
          if (localStorageRecord) {
            localStorageRecord.finishedParts.push(response);
            setLS(`video|${fileName}`, localStorageRecord);
          }
        } else {
          reject(new Error('Failed to upload video part to s3'));
        }
      };

      xhr.onerror = () => {
        const err = new Error(
          `Failed to upload video part to s3 | partNumber ${partNumber}`
        );
        const localStorageRecord = getAndParseLS(`video|${fileName}`);
        this.emit('uploadFailed', err, localStorageRecord);
        reject(err);
      };
      xhr.setRequestHeader('Content-Type', fileType);
      xhr.send(blob);
    });
  }

  private loopMultipartParts(
    file: File,
    uploadId: string,
    s3Filename: string,
    partSizeInBytes: number,
    totalParts: number,
    finishedPartsLookup: Record<number, object> = {}
  ): Promise<UploadPartResponse>[] {
    const promisesArr: Promise<UploadPartResponse>[] = [];
    const executing = new Set<Promise<unknown>>(); // used to throttle the PUT promises. Must be declared outside the for loop, so it persists across the loop

    // if there are no finishedParts (if this is a fresh upload), reset the percentage progress object
    if (Object.keys(finishedPartsLookup).length === 0) {
      this.partsUploadProgress = {};
    }

    for (let partNumber = 0; partNumber < totalParts; partNumber++) {
      // if there's already a finished part for this partNumber, skip to next in loop
      // partNumber + 1 because lookup is 1-based
      // eslint-disable-next-line no-continue
      if (finishedPartsLookup[partNumber + 1]) continue;

      const start = partNumber * partSizeInBytes;
      const end = Math.min(start + partSizeInBytes, file.size);
      const blob = file.slice(start, end);

      // send each part metadata (no binary needed here) to the backend to get it signed
      const getPartSignedUrlParams: UploadMultipartPartRequest = {
        partNumber: partNumber + 1,
        uploadId,
        s3Filename,
      };

      // promiseFnThrottle to ensure only (default 6) concurrent promises occur at once. This makes the upload more efficient for 2 reasons
      // 1 - browser or VPN doesn't like too many concurrent requests to the same domain
      // 2 - allows more parts to finish before others begin, making resuming unfinished uploads more efficient
      const putPartPromise = promiseFnThrottle(
        async () => {
          this.emit('uploadPartStarted', partNumber + 1);
          let getPartSignedUrl: UploadMultipartPartResponse;
          try {
            getPartSignedUrl = await this.uploadMultipartPart(
              getPartSignedUrlParams
            );
          } catch (err) {
            const errorObj = new Error(
              `failed uploadMultipartPart | part ${partNumber + 1} | ${err}`
            );
            this.emit('error', errorObj);
            throw errorObj;
          }
          const { signedUrl } = getPartSignedUrl;
          this.emit('uploadPartSignedUrl', partNumber + 1, signedUrl);
          return this.uploadPartToS3(
            signedUrl as string,
            blob,
            partNumber + 1,
            totalParts,
            file.type,
            file.name
          );
        },
        executing,
        this.options.concurrencyLimit
      );
      promisesArr.push(putPartPromise);
    }

    return promisesArr;
  }

  private async uploadUnfinishedMultipart(
    file: File,
    localRecord: LocalUploadRecord,
    metadata?: any
  ): Promise<string> {
    const { uploadId, s3Filename, finishedParts, totalParts, partSizeInBytes } =
      localRecord;

    // if any etags are null, we want to clean that up. Otherwise uploadUnfinishedMultipart will never successfully upload
    const cleanedFinishedParts: UploadPartResponse[] =
      cleanUpETags(finishedParts);
    setLS(`video|${file.name}`, {
      ...localRecord,
      finishedParts: cleanedFinishedParts,
    });

    // if anything is missing from the local storage record, we can't continue
    // delete it and continue a normal multipart upload
    const isCompleteLocalRecord = !!(
      uploadId &&
      s3Filename &&
      cleanedFinishedParts.length &&
      totalParts > 0 &&
      partSizeInBytes
    );
    if (!isCompleteLocalRecord) {
      removeLS(`video|${file.name}`);
      return this.uploadMultipart(file, metadata);
    }

    // start an upload parts array with the parts that are already finished from local storage
    const uploadPartsArray = cleanedFinishedParts;

    // set the already finished parts progress to 100 so the percentage will be accurate
    cleanedFinishedParts.forEach((part) => {
      this.partsUploadProgress[part.PartNumber] = 100;
    });
    const startingPercentage = Math.round(
      (cleanedFinishedParts.length / totalParts) * 100
    ) as NumberPercentageRange;
    this.emit('uploadResumed', startingPercentage, localRecord);
    this.emit('totalProgress', startingPercentage);

    // create a lookup by partNumber. Lookup is 1-based
    const finishedPartsLookup = cleanedFinishedParts.reduce(
      (obj: any, item: UploadPartResponse) => {
        // eslint-disable-next-line no-param-reassign
        obj[item.PartNumber] = item;
        return obj;
      },
      {}
    );

    // Loop through all parts
    const promisesArr = this.loopMultipartParts(
      file,
      uploadId,
      s3Filename,
      partSizeInBytes,
      totalParts,
      finishedPartsLookup
    );

    // wait until all parts are finished
    let resolvedArr = [] as UploadPartResponse[];
    try {
      resolvedArr = await Promise.all(promisesArr);
    } catch (err) {
      // if any of the parts failed to PUT to s3
      const errorObj = new Error(
        `Video Upload | one or more parts failed to upload to s3 | ${err}`
      );
      this.uploadInProgress = false;
      this.emit('error', errorObj);
      throw errorObj;
    }

    // push all the resuts to an array including the ETag header and PartNumber from each part PUT response
    resolvedArr.forEach((resolvedPromise) => {
      uploadPartsArray.push(resolvedPromise);
    });

    // Sort by partNumber because AWS requires ascending order on the complete call
    const sortedUploadPartsArray = uploadPartsArray.sort((a, b) => {
      if (a.PartNumber < b.PartNumber) return -1;
      if (a.PartNumber > b.PartNumber) return 1;
      return 0;
    });

    const completeParams: CompleteMultipartUploadRequest = {
      uploadId,
      s3Filename,
      parts: sortedUploadPartsArray,
    };

    let completeMultipartUpload: CompleteMultipartUploadResponse;

    try {
      completeMultipartUpload =
        await this.uploadMultipartComplete(completeParams);
    } catch (err) {
      const errorObj = new Error(`failed uploadMultipartComplete | ${err}`);
      this.uploadInProgress = false;
      this.emit('error', errorObj);
      throw errorObj;
    }

    const { s3Filename: s3FinalKey } = completeMultipartUpload;

    // Success!
    this.reset(file.name);
    this.emit('uploadComplete', s3FinalKey);

    return s3FinalKey;
  }

  public async uploadMultipart(
    file: File,
    metadata?: Record<string, string> | undefined
  ): Promise<string> {
    const partSizeInBytes =
      this.options.partMinSizeBytes + file.size / this.options.maxNumParts;
    const numParts = Math.ceil(file.size / partSizeInBytes);

    const localRecord: LocalUploadRecord =
      getAndParseLS(`video|${file.name}`) || {};
    // check if there is a record of a failed upload for this video, and furthermore, if any parts have already finished
    if (localRecord && localRecord?.finishedParts?.length > 0) {
      if (this.options.debugMode) {
        console.log(
          'Video Upload | unfinished upload found for this video',
          localRecord
        );
      }
      return this.uploadUnfinishedMultipart(file, localRecord, metadata);
    }

    this.uploadInProgress = true;
    this.emit('uploadStarted');

    let createMultipartUpload: CreateMultipartUploadResponse;
    try {
      createMultipartUpload = await this.uploadMultipartCreate({
        metadata,
        contentType: file.type,
      });
    } catch (err) {
      const errorObj = new Error(`failed uploadMultipartCreate | ${err}`);
      this.uploadInProgress = false;
      this.emit('error', errorObj);
      throw errorObj;
    }

    const { s3Filename, uploadId } = createMultipartUpload;

    this.emit('uploadCreated', uploadId, s3Filename);

    if (this.options.debugMode) {
      console.log('createMultipartUpload response', createMultipartUpload);
    }

    if (!s3Filename || !uploadId) {
      const errorObj = new Error(
        'uploadMultipartCreate | did not receive either s3Filename or uploadId'
      );
      this.uploadInProgress = false;
      this.emit('error', errorObj);
      throw errorObj;
    }

    // now that we have an uploadId and s3Filename, save it to LocalStorage so we can resume later if anything fails/disconnects
    const record: LocalUploadRecord = {
      originalFilename: file.name,
      totalFileSizeInBytes: file.size,
      totalParts: numParts,
      partSizeInBytes,
      finishedParts: [],
      uploadId,
      s3Filename,
    };
    setLS(`video|${file.name}`, record);

    const promisesArr = this.loopMultipartParts(
      file,
      uploadId,
      s3Filename,
      partSizeInBytes,
      numParts
    );

    if (this.options.debugMode) {
      console.log('part promises array after loopMultipartParts', promisesArr);
    }

    // wait until all parts are finished
    let resolvedArr = [] as UploadPartResponse[];
    try {
      resolvedArr = await Promise.all(promisesArr);
    } catch (err) {
      // if any of the parts failed to PUT to s3
      const errorObj = new Error(
        `Video Upload | one or more parts failed to upload to s3 | ${err}`
      );
      this.uploadInProgress = false;
      this.emit('error', errorObj);
      throw errorObj;
    }

    const completeParams: CompleteMultipartUploadRequest = {
      uploadId,
      s3Filename,
      parts: resolvedArr,
    };

    let completeMultipartUpload: CompleteMultipartUploadResponse;

    try {
      completeMultipartUpload =
        await this.uploadMultipartComplete(completeParams);
    } catch (err) {
      const errorObj = new Error(`failed uploadMultipartComplete | ${err}`);
      this.uploadInProgress = false;
      this.emit('error', errorObj);
      throw errorObj;
    }

    const { s3Filename: s3FinalKey } = completeMultipartUpload;

    // Success!
    this.reset(file.name);
    this.emit('uploadComplete', s3FinalKey);

    return s3FinalKey;
  }

  private reset(filename: string): void {
    this.uploadInProgress = false;
    this.partsUploadProgress = {};
    removeLS(`video|${filename}`);
  }

  public isUploadInProgress(): boolean {
    return this.uploadInProgress;
  }
}
