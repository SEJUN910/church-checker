import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Gemini API를 사용하여 오늘의 말씀 생성
async function generateVerseWithGemini(): Promise<{ text: string; reference: string } | null> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not found');
    return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `오늘의 성경 구절을 하나 추천해주세요.

응답 형식:
구절: [성경 구절 내용]
출처: [책 이름 장:절]

예시:
구절: 하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라
출처: 요한복음 3:16

한국어 개역한글 성경을 사용하며, 실제 성경 구절만 제공해주세요. 추가 설명은 하지 마세요.`
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 200,
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('No text in Gemini response');
      return null;
    }

    // 응답 파싱
    const lines = text.trim().split('\n');
    let verseText = '';
    let reference = '';

    for (const line of lines) {
      if (line.startsWith('구절:')) {
        verseText = line.replace('구절:', '').trim();
      } else if (line.startsWith('출처:')) {
        reference = line.replace('출처:', '').trim();
      }
    }

    if (verseText && reference) {
      return { text: verseText, reference };
    }

    return null;
  } catch (error) {
    console.error('Error generating verse with Gemini:', error);
    return null;
  }
}

// 기본 성경 구절 목록 (API 실패 시 사용)
const fallbackVerses = [
  {
    text: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라',
    reference: '요한복음 3:16'
  },
  {
    text: '여호와는 나의 목자시니 내게 부족함이 없으리로다',
    reference: '시편 23:1'
  },
  {
    text: '너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라',
    reference: '잠언 3:5'
  },
  {
    text: '내가 주께 바라는 것은 오직 한 가지 일이니 곧 내가 내 생전에 여호와의 집에 살면서 여호와의 아름다움을 바라보며 그의 성전에서 사모하는 그것이라',
    reference: '시편 27:4'
  },
  {
    text: '수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라',
    reference: '마태복음 11:28'
  }
];

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. 먼저 DB에서 오늘 날짜의 말씀 확인
    const { data: existingVerse, error: selectError } = await supabase
      .from('daily_verses')
      .select('*')
      .eq('verse_date', today)
      .single();

    if (!selectError && existingVerse) {
      return NextResponse.json({
        text: existingVerse.verse_text,
        reference: existingVerse.verse_reference,
        source: existingVerse.source
      });
    }

    // 2. DB에 없으면 Gemini API로 생성 시도
    const generatedVerse = await generateVerseWithGemini();

    let verseToSave;
    let source = 'gemini';

    if (generatedVerse) {
      verseToSave = generatedVerse;
    } else {
      // 3. Gemini 실패 시 fallback 목록에서 랜덤 선택
      const randomIndex = Math.floor(Math.random() * fallbackVerses.length);
      verseToSave = fallbackVerses[randomIndex];
      source = 'fallback';
    }

    // 4. DB에 저장
    const { data: savedVerse, error: insertError } = await supabase
      .from('daily_verses')
      .insert([{
        verse_date: today,
        verse_text: verseToSave.text,
        verse_reference: verseToSave.reference,
        source: source
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error saving verse:', insertError);
      // 저장 실패해도 생성된 구절은 반환
      return NextResponse.json({
        text: verseToSave.text,
        reference: verseToSave.reference,
        source: source
      });
    }

    return NextResponse.json({
      text: savedVerse.verse_text,
      reference: savedVerse.verse_reference,
      source: savedVerse.source
    });

  } catch (error) {
    console.error('Error in daily-verse API:', error);

    // 에러 시에도 fallback 구절 반환
    const randomIndex = Math.floor(Math.random() * fallbackVerses.length);
    return NextResponse.json({
      text: fallbackVerses[randomIndex].text,
      reference: fallbackVerses[randomIndex].reference,
      source: 'fallback'
    });
  }
}
