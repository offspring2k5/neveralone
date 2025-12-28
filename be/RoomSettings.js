/**
 * be/RoomSettings.js
 * Data Model for Room Configuration
 * Purpose: 
 * - strict-typed class that holds configuration data (Theme, MaxUsers, Privacy)
 * - Ensures invalid data (like a string for 'maxUsers') is caught immediately
 * - Used by Room class to store settings
 */

class RoomSettings {
    /** parameter types
     * _ to indicate variables are private
     * @param {Boolean} _isPrivate
     * @param {number} _maxUsers 
     * @param {String} _theme
     */
    
    constructor (isPrivate, maxUsers, theme) {
        this.setIsPrivate(isPrivate);
        this.setMaxUsers(maxUsers);
        this.setTheme(theme);
    }

    getIsPrivate() {
        return this._isPrivate;
    }

    getMaxUsers() {
        return this._maxUsers;
    }

    getTheme() {
        return this._theme;
    }

    setIsPrivate(isPrivate) {
        if (typeof isPrivate !== 'boolean') {
            throw new Error(`invalid type. expected boolean, got ${typeof isPrivate}`);
        }
        this._isPrivate = isPrivate;

    }

    setMaxUsers(maxUsers) {
        if (typeof maxUsers !== 'number' || !Number.isInteger(maxUsers)) {
            throw new Error(`invalid type. expected integer number, got ${typeof maxUsers}`);
        }
        this._maxUsers = maxUsers;
    }

    setTheme(theme) {
         if (typeof theme !== 'string') {
            throw new Error(`invalid type. expected string, got ${typeof theme}`);
        }
        this._theme = theme;
    }

    toJSON() {
        return {
            isPrivate: this._isPrivate,
            maxUsers: this._maxUsers,
            theme: this._theme
        };
    }

}
module.exports = RoomSettings