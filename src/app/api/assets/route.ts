import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Allowed base paths for security
const ALLOWED_BASES = [
  '/home/ec2-user/clawd/projects/pam-carousel/output',
  '/home/ec2-user/clawd/projects/tiktok-carousels',
  '/home/ec2-user/clawd/projects/outreach-engine',
  '/home/ec2-user/clawd/projects/sola-instagram',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const action = searchParams.get('action') || 'serve'; // 'serve' or 'list'
    
    if (!filePath) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }
    
    // Security: Ensure path is within allowed bases
    const normalizedPath = path.normalize(filePath);
    const isAllowed = ALLOWED_BASES.some(base => normalizedPath.startsWith(base));
    if (!isAllowed) {
      return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
    }
    
    // List directory contents
    if (action === 'list') {
      if (!fs.existsSync(normalizedPath)) {
        return NextResponse.json({ files: [] });
      }
      
      const stat = fs.statSync(normalizedPath);
      if (stat.isDirectory()) {
        const files = fs.readdirSync(normalizedPath)
          .filter(f => /\.(png|jpg|jpeg|gif|mp4|mov)$/i.test(f))
          .map(f => ({
            name: f,
            path: path.join(normalizedPath, f),
            url: `/api/assets?path=${encodeURIComponent(path.join(normalizedPath, f))}`,
          }));
        return NextResponse.json({ files });
      }
      return NextResponse.json({ files: [] });
    }
    
    // Serve file
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    const stat = fs.statSync(normalizedPath);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: 'Cannot serve directory' }, { status: 400 });
    }
    
    const ext = path.extname(normalizedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(normalizedPath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${path.basename(normalizedPath)}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Assets API error:', error);
    return NextResponse.json({ error: 'Failed to serve asset' }, { status: 500 });
  }
}
