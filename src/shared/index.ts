export type UploadPartResponse = {
  /** The ETag from the HTTP Put response */
  ETag: string;
  /** The part number of the upload (1-based)' */
  PartNumber: number;
};

export type CreateMultipartUploadRequest = {
  /** The metadata object requested to set on the S3 record' */
  metadata?: Record<string, string> | undefined;
  /** The Content-Type header that will eventually be on the S3 record. If not passed, defaults to 'binary/octet-stream' */
  contentType?: string;
};

export type CreateMultipartUploadResponse = {
  /** The uploadId AWS has generated for this multipart upload request */
  uploadId: string;
  /** The S3 filename (key) that will exist once the multipart upload is completed */
  s3Filename: string;
};

export type UploadMultipartPartRequest = {
  /** The part number of this upload (1-based)' */
  partNumber: number;
  /** The uploadId AWS has generated for this multipart upload request */
  uploadId: string;
  /** The uploadId AWS generated in the original create request. Must match throughout the process for upload to complete successfully */
  s3Filename: string;
};

export type UploadMultipartPartResponse = {
  /** The part number of this upload (1-based)' */
  partNumber: number;
  /** The uploadId AWS generated in the original create request. Must match throughout the process for upload to complete successfully */
  uploadId: string;
  /** The S3 filename (key) that was generated in the original create request */
  s3Filename: string;
  /** The presigned AWS url that will be used for the HTTP PUT request of this part */
  signedUrl: string;
};

export type CompleteMultipartUploadRequest = {
  /** The uploadId AWS generated in the original create request. Must match throughout the process for upload to complete successfully */
  uploadId: string;
  /** The S3 filename (key) that will exist once this multipart complete request is completed */
  s3Filename: string;
  /** An array of the upload parts metadata, matching part numbers with their ETag headers from the respective HTTP PUT responses */
  parts: UploadPartResponse[];
};

export type CompleteMultipartUploadResponse = {
  /** The S3 filename (key) that now exists in the S3 bucket. Upload is completed */
  s3Filename: string;
};

type Range<
  N extends number,
  Result extends Array<unknown> = [],
> = Result['length'] extends N
  ? Result[number]
  : Range<N, [...Result, Result['length']]>;

export type NumberPercentageRange = Range<101>; // Creates a type for numbers 0 to 100
