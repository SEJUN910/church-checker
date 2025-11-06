import { createClient } from './client'

/**
 * 학생 사진을 Supabase Storage에 업로드
 * @param file - 업로드할 이미지 파일
 * @param studentId - 학생 ID
 * @param churchId - 교회 ID
 * @returns 업로드된 이미지의 public URL
 */
export async function uploadStudentPhoto(
  file: File,
  studentId: string,
  churchId: string
): Promise<string | null> {
  try {
    const supabase = createClient()

    // 파일 확장자 추출
    const fileExt = file.name.split('.').pop()
    // 파일명: {church_id}/{student_id}.{ext}
    const filePath = `${churchId}/${studentId}.${fileExt}`

    console.log('Uploading to path:', filePath)

    // 기존 파일이 있으면 삭제
    await supabase.storage.from('student-photos').remove([filePath])

    // 새 파일 업로드
    const { data, error } = await supabase.storage
      .from('student-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      console.error('Upload error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return null
    }

    console.log('Upload successful:', data)

    // Public URL 생성
    const {
      data: { publicUrl },
    } = supabase.storage.from('student-photos').getPublicUrl(data.path)

    console.log('Public URL:', publicUrl)

    return publicUrl
  } catch (error) {
    console.error('Error uploading photo:', error)
    return null
  }
}

/**
 * 학생 사진 삭제
 * @param photoUrl - 삭제할 사진의 URL
 */
export async function deleteStudentPhoto(photoUrl: string): Promise<boolean> {
  try {
    const supabase = createClient()

    // URL에서 파일 경로 추출
    const url = new URL(photoUrl)
    const pathParts = url.pathname.split('/')
    const filePath = pathParts.slice(-2).join('/') // church_id/student_id.ext

    const { error } = await supabase.storage
      .from('student-photos')
      .remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting photo:', error)
    return false
  }
}

/**
 * 이미지 미리보기 URL 생성
 * @param file - 이미지 파일
 * @returns 미리보기 URL
 */
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * 이미지 미리보기 URL 해제
 * @param url - 해제할 미리보기 URL
 */
export function revokeImagePreview(url: string): void {
  URL.revokeObjectURL(url)
}

/**
 * 프로필 사진을 Supabase Storage에 업로드
 * @param userId - 사용자 ID
 * @param file - 업로드할 이미지 파일
 * @returns 업로드된 이미지의 public URL
 */
export async function uploadProfilePhoto(
  userId: string,
  file: File
): Promise<string | null> {
  try {
    const supabase = createClient()

    // 파일 확장자 추출
    const fileExt = file.name.split('.').pop()
    // 파일명: profiles/{user_id}.{ext}
    const filePath = `profiles/${userId}.${fileExt}`

    console.log('Uploading profile photo to:', filePath)

    // 기존 파일이 있으면 삭제
    await supabase.storage.from('avatars').remove([filePath])

    // 새 파일 업로드
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      console.error('Profile photo upload error:', error)
      return null
    }

    console.log('Profile photo upload successful:', data)

    // Public URL 생성
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(data.path)

    console.log('Profile photo public URL:', publicUrl)

    return publicUrl
  } catch (error) {
    console.error('Error uploading profile photo:', error)
    return null
  }
}

/**
 * 공지사항 이미지를 Supabase Storage에 업로드
 * @param churchId - 교회 ID
 * @param announcementId - 공지사항 ID
 * @param file - 업로드할 이미지 파일
 * @returns 업로드된 이미지의 public URL
 */
export async function uploadAnnouncementImage(
  churchId: string,
  announcementId: string,
  file: File
): Promise<string | null> {
  try {
    const supabase = createClient()

    // 파일 확장자 추출
    const fileExt = file.name.split('.').pop()
    // 파일명: {church_id}/{announcement_id}.{ext}
    const filePath = `${churchId}/${announcementId}.${fileExt}`

    console.log('Uploading announcement image to:', filePath)

    // 기존 파일이 있으면 삭제
    await supabase.storage.from('announcement-images').remove([filePath])

    // 새 파일 업로드
    const { data, error } = await supabase.storage
      .from('announcement-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      console.error('Announcement image upload error:', error)
      return null
    }

    console.log('Announcement image upload successful:', data)

    // Public URL 생성
    const {
      data: { publicUrl },
    } = supabase.storage.from('announcement-images').getPublicUrl(data.path)

    console.log('Announcement image public URL:', publicUrl)

    return publicUrl
  } catch (error) {
    console.error('Error uploading announcement image:', error)
    return null
  }
}

/**
 * 공지사항 이미지 삭제
 * @param imageUrl - 삭제할 이미지의 URL
 */
export async function deleteAnnouncementImage(imageUrl: string): Promise<boolean> {
  try {
    const supabase = createClient()

    // URL에서 파일 경로 추출
    const url = new URL(imageUrl)
    const pathParts = url.pathname.split('/')
    const filePath = pathParts.slice(-2).join('/') // church_id/announcement_id.ext

    const { error } = await supabase.storage
      .from('announcement-images')
      .remove([filePath])

    if (error) {
      console.error('Delete announcement image error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting announcement image:', error)
    return false
  }
}
