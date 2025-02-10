import { NextResponse } from 'next/server';

const API_URL = 'https://autonome.alt.technology/yieldmax-yilblw';
const API_KEY = 'eWllbGRtYXg6YUViZ1VmbWhWYQ==';

export const maxDuration = 60
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(`${API_URL}/message`, {
      method: 'POST',
      headers: {
        'Authorization': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Autonome' },
      { status: 500 }
    );
  }
}

export async function GET() {
    try {
        const response = await fetch(`${API_URL}/heartbeat`, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY
            }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Heartbeat error:', error);
        return NextResponse.json(
            { error: 'Failed to check heartbeat' },
            { status: 500 }
        );
    }
} 