import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

interface RouteContextParams {
  bucket: string;
  objectKey: string[];
}

// Initialize the S3 client for R2
// Ensure your R2 credentials and endpoint are set as environment variables
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2Endpoint = r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined;

if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2Endpoint) {
  console.error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_ENDPOINT is not defined in environment variables.");
  // Depending on your error handling strategy, you might throw an error here
  // or allow the server to start and fail on request if these are truly required at runtime.
}

const s3Client = new S3Client({
  region: 'auto', // For R2, 'auto' is often used or a specific region if known
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: r2AccessKeyId!,
    secretAccessKey: r2SecretAccessKey!,
  },
});

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<RouteContextParams> }
) {
  const params = await paramsPromise;
  const bucketName = params.bucket;
  // The objectKey is an array of path segments, so join them back with '/'
  const objectKey = params.objectKey.join('/');

  if (!bucketName || !objectKey) {
    return NextResponse.json({ error: 'Bucket name and object key are required.' }, { status: 400 });
  }
  
  if (!r2Endpoint) { // Check if endpoint was configured
    console.error("R2 endpoint is not configured due to missing R2_ACCOUNT_ID.");
    return NextResponse.json({ error: 'R2 service is not configured on the server.' }, { status: 500 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    const { Body, ContentType, ContentLength, Metadata } = await s3Client.send(command);

    if (!Body || !(Body instanceof Readable)) {
      // For Node.js stream type, use 'Body instanceof require("stream").Readable'
      // For Web stream, it might be 'Body instanceof ReadableStream'
      // Adjust based on your Vercel/Node.js environment and SDK version
      // The AWS SDK v3 typically returns a Readable stream for Node.js environments.
      return NextResponse.json({ error: 'Could not retrieve file body from R2.' }, { status: 500 });
    }

    // Convert Node.js Readable to Web ReadableStream for NextResponse
    // Vercel Edge functions might handle Node.js streams directly, but this is safer for broader compatibility.
    const webReadableStream = new ReadableStream({
      start(controller) {
        Body.on('data', (chunk) => controller.enqueue(chunk));
        Body.on('end', () => controller.close());
        Body.on('error', (err) => controller.error(err));
      },
      cancel() {
        Body.destroy();
      },
    });
    
    const headers = new Headers();
    if (ContentType) {
      headers.set('Content-Type', ContentType);
    } else {
      // Fallback content type if not available from R2 (should be rare)
      headers.set('Content-Type', 'application/octet-stream');
    }
    if (ContentLength) {
      headers.set('Content-Length', ContentLength.toString());
    }

    // Try to get filename from R2 metadata (if set during upload with ContentDisposition)
    // or infer from objectKey
    let filename = Metadata?.['filename'] || objectKey.substring(objectKey.lastIndexOf('/') + 1);
    // Ensure filename is somewhat safe
    filename = filename.replace(/[^a-zA-Z0-9._-]+/g, '_'); 

    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(webReadableStream, {
      status: 200,
      headers: headers,
    });

  } catch (error: unknown) {
    console.error('Error fetching from R2:', error);
    // Check for common S3 errors like NoSuchKey
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.name === 'NoSuchKey') {
        return NextResponse.json({ error: 'File not found in R2.' }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Failed to download file from R2.', details: errorMessage }, { status: 500 });
  }
} 