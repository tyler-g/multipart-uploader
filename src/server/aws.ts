import {
  S3Client,
  UploadPartCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommandInput,
  CompleteMultipartUploadCommandInput,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { convertMetadata } from '../shared/util.js';
import type { UploadPartResponse } from '../shared/index.js';
import type { AwsConfig, FilenameGeneratorFn } from './types.js';

function getS3(config: S3ClientConfig) {
  return new S3Client(config);
}

export const getUploadPartURL = async (
  awsConfig: AwsConfig,
  partNumber: number,
  uploadId: string,
  s3Filename: string
) => {
  const s3 = getS3(awsConfig.s3Config ?? {});
  const command = {
    Bucket: awsConfig.bucket,
    Key: s3Filename,
    PartNumber: partNumber,
    UploadId: uploadId,
  };
  const signedPartUrl = await getSignedUrl(s3, new UploadPartCommand(command), {
    expiresIn: awsConfig.signedUrlExpiration,
  });
  return {
    signedPartUrl,
    s3Filename,
  };
};

export const createS3MultipartUpload = async (
  awsConfig: AwsConfig,
  fileNameGeneratorFn?: FilenameGeneratorFn,
  metadata?: Record<string, string> | undefined,
  contentType?: string | undefined
) => {
  const s3 = getS3(awsConfig.s3Config ?? {});
  let s3Filename: string;

  if (fileNameGeneratorFn) {
    s3Filename = fileNameGeneratorFn();
  } else {
    // if no generator fn for filename is passed, generate a random id
    s3Filename = crypto.randomUUID();
  }
  const command: CreateMultipartUploadCommandInput = {
    Bucket: awsConfig.bucket,
    Key: s3Filename,
    Metadata: { ...convertMetadata(metadata) },
    ContentType: contentType,
  };

  if (command.Metadata === null) {
    delete command.Metadata;
  }
  if (command.ContentType === null) {
    // without a passed ContentType, it will default to 'binary/octet-stream'
    delete command.ContentType;
  }

  const multipartUpload = await s3.send(new CreateMultipartUploadCommand(command));
  const { UploadId } = multipartUpload;

  return {
    UploadId,
    s3Filename,
  };
};

export const completeS3MultipartUpload = async (
  awsConfig: AwsConfig,
  uploadId: string,
  keyId: string,
  parts: UploadPartResponse[]
) => {
  const s3 = getS3(awsConfig.s3Config ?? {});

  const command: CompleteMultipartUploadCommandInput = {
    Bucket: awsConfig.bucket,
    Key: keyId,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  };
  return s3.send(new CompleteMultipartUploadCommand(command));
};
