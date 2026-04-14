import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import DailyReview from '@/models/DailyReview';

// GET /api/reviews
export async function GET() {
  try {
    await connectDB();
    const reviews = await DailyReview.find().sort({ date: -1 });
    return NextResponse.json(reviews);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/reviews
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { date, whatGotDone, whatStoppedMe } = body;

    if (!date || !whatGotDone || !whatStoppedMe) {
      return NextResponse.json(
        { error: 'date, whatGotDone, whatStoppedMe are required' },
        { status: 400 }
      );
    }

    // Upsert by date
    const review = await DailyReview.findOneAndUpdate(
      { date },
      { whatGotDone, whatStoppedMe },
      { upsert: true, new: true }
    );

    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
