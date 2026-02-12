import {
  createS3MultipartUpload,
  getUploadPartURL,
  completeS3MultipartUpload,
} from './aws.js';
import { deepMerge } from '../shared/util.js';

import type {
  CreateMultipartUploadRequest,
  CreateMultipartUploadResponse,
  UploadMultipartPartRequest,
  UploadMultipartPartResponse,
  CompleteMultipartUploadRequest,
  CompleteMultipartUploadResponse,
} from '../shared/index.js';

import type { AwsConfig, FilenameGeneratorFn } from './types.js';

export type MultipartUploaderBackendOptions = {
  /** Required: Config for the AWS operations */
  awsConfig: AwsConfig;
  /** A string-returning function used to generate the S3 filename ; defaults to null (and thus crypto random uuid generated filename) */
  filenameGeneratorFn?: FilenameGeneratorFn;
  /** With debug mode on, you will get more informational console logs; defaults to false */
  debugMode?: boolean;
};

const defaultOptions = {
  awsConfig: {
    s3Config: {
      region: 'us-east-1',
    },
    signedUrlExpiration: 3 * 60, // 3 minutes
  },
  filenameGeneratorFn: null,
  debugMode: false,
};

/** Create a new MultipartUploaderBackend instance */
export class MultipartUploaderBackend {
  public options: MultipartUploaderBackendOptions & typeof defaultOptions;
  private awsConfig = {} as AwsConfig;

  constructor(options: MultipartUploaderBackendOptions) {
    this.options = deepMerge({ ...defaultOptions }, options);
    if (this.options.debugMode) {
      console.log('MultipartUploaderBackend constructor', this.options);
    }
    if (!this.options.awsConfig.bucket) {
      throw new Error(
        'bucket required in the awsConfig constructor options. Not found'
      );
    }

    this.awsConfig = this.options.awsConfig;
  }
  public async createMultipartUpload(
    request: CreateMultipartUploadRequest
  ): Promise<CreateMultipartUploadResponse> {
    const { metadata, contentType } = request;

    let uploadId: string | undefined;
    let s3Filename: string | undefined;

    try {
      const result = await createS3MultipartUpload(
        this.awsConfig,
        this.options.filenameGeneratorFn,
        metadata,
        contentType
      );
      uploadId = result.UploadId;
      s3Filename = result.s3Filename;

      if (!uploadId || !s3Filename) {
        throw new Error(
          'failed to get either uploadId or s3Filename from createS3MultipartUpload'
        );
      }
    } catch (error) {
      throw new Error(
        `failed createS3MultipartUpload: ${error} | metadata ${JSON.stringify(metadata)}`
      );
    }

    return {
      uploadId,
      s3Filename,
    };
  }

  /**
   * Gets a signed URL given a partNumber, uploadId and s3Filename
   * @param {UploadMultipartPartRequest} request - The request.
   * @returns {UploadMultipartPartResponse}
   */
  public async uploadMultipartPart(
    request: UploadMultipartPartRequest
  ): Promise<UploadMultipartPartResponse> {
    const { uploadId, s3Filename, partNumber } = request;

    let signedUrl: string;

    try {
      const result = await getUploadPartURL(
        this.awsConfig,
        partNumber,
        uploadId,
        s3Filename
      );
      signedUrl = result.signedPartUrl;
    } catch (error) {
      throw new Error(
        `failed to retrieve signed URL in uploadMultipartPart: ${error} | uploadId ${uploadId} | s3Filename ${s3Filename} | partNumber ${partNumber}`
      );
    }

    return {
      partNumber,
      uploadId,
      s3Filename,
      signedUrl,
    };
  }

  public async completeMultipartUpload(
    request: CompleteMultipartUploadRequest
  ): Promise<CompleteMultipartUploadResponse> {
    const { uploadId, s3Filename } = request;
    const { parts } = request;

    try {
      await completeS3MultipartUpload(
        this.awsConfig,
        uploadId,
        s3Filename,
        parts
      );
    } catch (error) {
      throw new Error(
        `failed completeMultipartUpload: ${error} | uploadId ${uploadId} | s3Filename ${s3Filename}`
      );
    }

    return {
      s3Filename,
    };
  }
}
