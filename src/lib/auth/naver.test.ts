// T082 네이버 로그인 헬퍼 테스트 — state 쿠키 왕복·오픈 리다이렉트 차단·인가 URL 구성.
import { describe, expect, test } from 'vitest';
import { buildAuthorizeUrl, encodeStateCookie, parseStateCookie, safeNext } from './naver';

describe('safeNext — 오픈 리다이렉트 방지', () => {
  test('내부 경로는 그대로 통과', () => {
    expect(safeNext('/profiles')).toBe('/profiles');
    expect(safeNext('/home?tab=1')).toBe('/home?tab=1');
  });

  test('외부·프로토콜 상대 URL·빈 값은 기본 경로로 폴백', () => {
    expect(safeNext('https://evil.example')).toBe('/profiles');
    expect(safeNext('//evil.example')).toBe('/profiles');
    expect(safeNext(null)).toBe('/profiles');
    expect(safeNext(undefined)).toBe('/profiles');
    expect(safeNext('')).toBe('/profiles');
  });
});

describe('state 쿠키 직렬화 왕복', () => {
  test('encode → parse 왕복 시 state·next 보존', () => {
    const raw = encodeStateCookie('abc123', '/profiles');
    expect(parseStateCookie(raw)).toEqual({ state: 'abc123', next: '/profiles' });
  });

  test('next가 외부 URL이면 파싱 단계에서 기본 경로로 정화', () => {
    const raw = encodeStateCookie('abc123', 'https://evil.example');
    expect(parseStateCookie(raw)).toEqual({ state: 'abc123', next: '/profiles' });
  });

  test('없거나 훼손된 쿠키는 null', () => {
    expect(parseStateCookie(undefined)).toBeNull();
    expect(parseStateCookie('not-json')).toBeNull();
    expect(parseStateCookie(encodeURIComponent('{"next":"/profiles"}'))).toBeNull(); // state 누락
  });
});

describe('buildAuthorizeUrl', () => {
  test('네이버 인가 엔드포인트에 필수 파라미터 4종을 싣는다', () => {
    const url = new URL(buildAuthorizeUrl('client-id', 'http://localhost:3000', 'st4te'));
    expect(url.origin + url.pathname).toBe('https://nid.naver.com/oauth2.0/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/naver/callback');
    expect(url.searchParams.get('state')).toBe('st4te');
  });
});
