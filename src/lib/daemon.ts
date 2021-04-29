export  default class Daemon {
    static _isRunning: Boolean = false;

    public static get isRunning():Boolean{
        return this._isRunning;
    }

}