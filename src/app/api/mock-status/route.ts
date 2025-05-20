// Static mock status endpoint for SSE
export async function GET() {
  // Set headers for SSE
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Create a delay function
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Encode server-sent event
  const encodeSSE = (data: Record<string, unknown>) => {
    return `data: ${JSON.stringify(data)}\n\n`;
  };

  // Use streaming response
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          // Initial status
          controller.enqueue(new TextEncoder().encode(encodeSSE({
            status: 'PROGRESS', 
            message: 'Starting conversion process...'
          })));
          
          await delay(1000);

          // Crawling phase
          for (let i = 1; i <= 3; i++) {
            controller.enqueue(new TextEncoder().encode(encodeSSE({
              status: 'PROGRESS', 
              message: `Crawling documentation pages...`, 
              current_url: `https://example.com/docs/page${i}`,
              crawled: i,
              max_pages: 5
            })));
            
            await delay(800);
          }

          // Processing phase
          for (let i = 1; i <= 3; i++) {
            controller.enqueue(new TextEncoder().encode(encodeSSE({
              status: 'PROGRESS', 
              message: `Converting HTML to Markdown...`,
              pages_saved: i
            })));
            
            await delay(600);
          }

          // Final success status
          controller.enqueue(new TextEncoder().encode(encodeSSE({
            status: 'SUCCESS', 
            message: 'Conversion completed successfully!',
            result: {
              r2Bucket: 'test-bucket',
              r2ObjectKey: `output-test-123.${Math.random() < 0.5 ? 'zip' : 'md'}`,
              pages_crawled: 5
            }
          })));
          
          controller.close();
        } catch (error) {
          console.error('Error in SSE stream:', error);
          controller.close();
        }
      }
    }),
    { headers }
  );
} 