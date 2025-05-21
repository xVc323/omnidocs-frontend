> **This is the frontend for [OmniDocs](https://github.com/xVc323/omnidocs).**
> For backend setup, API details, and more, see the [main OmniDocs repository](https://github.com/xVc323/omnidocs).

# OmniDocs Converter - Frontend

This is the frontend for OmniDocs Converter, a tool that converts documentation websites into Markdown files that are **LLM-friendly and ready for AI ingestion**. Built with Next.js, React, and Tailwind CSS.

## Features

- Clean, intuitive UI with dark mode support
- Mobile-responsive design
- Real-time progress updates during document conversion
- Advanced options for specifying path prefixes and exclusions
- Support for multiple output formats (ZIP with multiple MD files or single MD file)
- **LLM-Optimized Output**: All generated Markdown is structured for easy use in large language models, RAG, and vector databases

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

This frontend requires a backend API to function properly. Create a `.env.local` file with:

```
# API endpoint for the OmniDocs backend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Backend Requirements

This frontend works with the [OmniDocs backend API](https://github.com/xVc323/omnidocs).
Make sure the backend server is running before using the frontend.
See the [main repository README](https://github.com/xVc323/omnidocs#readme) for backend setup instructions.

## Developing

- `src/app/page.tsx` - The main page component
- `src/app/globals.css` - Global styles and Tailwind CSS customizations
- `src/app/layout.tsx` - Root layout component

## Building for Production

To create an optimized production build:

```bash
npm run build
# or
yarn build
```

Start the production server:

```bash
npm run start
# or
yarn start
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.