-- 응원메세지 좋아요 수 컬럼 추가
ALTER TABLE public_love_messages ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;

-- 좋아요 증가 함수
CREATE OR REPLACE FUNCTION increment_message_likes(message_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_count INT;
BEGIN
  UPDATE public_love_messages SET likes_count = likes_count + 1 WHERE id = message_id RETURNING likes_count INTO new_count;
  RETURN new_count;
END;
$$;

-- 좋아요 감소 함수 (0 미만 방지)
CREATE OR REPLACE FUNCTION decrement_message_likes(message_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_count INT;
BEGIN
  UPDATE public_love_messages SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = message_id RETURNING likes_count INTO new_count;
  RETURN new_count;
END;
$$;
