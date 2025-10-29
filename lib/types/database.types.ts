// Supabase 데이터베이스 타입 정의

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          kakao_id: string | null;
          name: string;
          phone: string | null;
          profile_image: string | null;
          role: 'admin' | 'teacher' | 'member';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          kakao_id?: string | null;
          name: string;
          phone?: string | null;
          profile_image?: string | null;
          role?: 'admin' | 'teacher' | 'member';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kakao_id?: string | null;
          name?: string;
          phone?: string | null;
          profile_image?: string | null;
          role?: 'admin' | 'teacher' | 'member';
          created_at?: string;
          updated_at?: string;
        };
      };
      churches: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      church_members: {
        Row: {
          id: string;
          church_id: string;
          user_id: string;
          role: 'admin' | 'teacher' | 'member';
          joined_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          user_id: string;
          role?: 'admin' | 'teacher' | 'member';
          joined_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          user_id?: string;
          role?: 'admin' | 'teacher' | 'member';
          joined_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          church_id: string;
          name: string;
          phone: string | null;
          age: number | null;
          grade: string | null;
          registered_by: string | null;
          registered_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          name: string;
          phone?: string | null;
          age?: number | null;
          grade?: string | null;
          registered_by?: string | null;
          registered_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          name?: string;
          phone?: string | null;
          age?: number | null;
          grade?: string | null;
          registered_by?: string | null;
          registered_at?: string;
          updated_at?: string;
        };
      };
      attendance: {
        Row: {
          id: string;
          student_id: string;
          church_id: string;
          date: string;
          checked_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          church_id: string;
          date?: string;
          checked_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          church_id?: string;
          date?: string;
          checked_by?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
