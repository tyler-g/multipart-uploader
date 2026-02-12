import type { S3ClientConfig } from '@aws-sdk/client-s3';

export type AwsConfig = {
  /** Required: The S3 bucket for the uploads */
  bucket: string;
  /** The expiration time (in seconds) of the generated signed URLs for each part */
  signedUrlExpiration?: number;
  /** The full config options available for the AWS S3 client package */
  s3Config?: S3ClientConfig;
};

export type FilenameGeneratorFn = (() => string) | null;
