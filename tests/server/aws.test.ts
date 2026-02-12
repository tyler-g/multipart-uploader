import { describe, it, expect, beforeAll } from 'vitest';
import {
  createS3MultipartUpload,
  getUploadPartURL,
} from '../../src/server/aws';
import type { AwsConfig } from '../../src/server/types';

const S3_BUCKET = 'multipart-uploader-dev';
const DUMMY_FILENAME = 'fn-generated-filename';
const EXPIRATION_SECONDS = 180;

let awsConfig: AwsConfig;
let uploadId: string;

beforeAll(() => {
  awsConfig = {
    bucket: S3_BUCKET,
    signedUrlExpiration: EXPIRATION_SECONDS,
    s3Config: {
      region: 'us-east-1',
    },
  };
});
describe('server | aws | createS3MultipartUpload', () => {
  it('returns an UploadId and s3Filename when passed a valid AwsConfig', async () => {
    const result = await createS3MultipartUpload(awsConfig);
    expect(result.UploadId).toBeTypeOf('string');
    expect(result.s3Filename).toBeTypeOf('string');
  });
  it('returns a fn-generated s3Filename when passing a filename generator fn', async () => {
    const filenameGenerator = () => {
      return DUMMY_FILENAME;
    };
    const result = await createS3MultipartUpload(awsConfig, filenameGenerator);
    uploadId = result.UploadId as string;
    expect(result.s3Filename).toEqual(DUMMY_FILENAME);
  });
});
describe('server | aws | getUploadPartURL', () => {
  it('returns a valid signed URL when passing a valid AwsConfig, PartNmber and UploadId', async () => {
    const result = await getUploadPartURL(
      awsConfig,
      1,
      uploadId,
      DUMMY_FILENAME
    );
    expect(result.signedPartUrl).toBeDefined();
    expect(result.signedPartUrl).toBeTypeOf('string');
    expect(result.signedPartUrl).toContain(S3_BUCKET);
    expect(result.signedPartUrl).toContain(`/${DUMMY_FILENAME}`);
    expect(result.signedPartUrl).toContain(`Amz-Expires=${EXPIRATION_SECONDS}`);
    expect(result.signedPartUrl).toContain(
      `&partNumber=1&uploadId=${uploadId}`
    );
    console.log('result', result);
  });
});
