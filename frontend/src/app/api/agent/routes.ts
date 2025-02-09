import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'https://autonome.alt.technology/yieldmax-rgamik';
const API_KEY = process.env.API_KEY || 'Basic eWllbGRtYXg6SVFTb1JabU16Sg==';

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
    });

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