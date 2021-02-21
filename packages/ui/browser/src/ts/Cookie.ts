export const setCookie = (name: string, value: string, expiresDays: number): void => {
    const date = new Date();
    date.setTime(date.getTime() + (expiresDays * 24 * 60 * 60 * 1000));
    const expires = 'expires=' + date.toUTCString();
    document.cookie = name + '=' + value + ';' + expires + ';path=/';
};

export const getCookie = (name: string): string => {
    const namePrefix = name + '=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(namePrefix) === 0) {
            return c.substring(namePrefix.length, c.length);
        }
    }
    return '';
};

export const deleteCookie = (name: string): void => {
    document.cookie = name +'=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};
