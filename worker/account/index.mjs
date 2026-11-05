import {createSession} from '../tls.mjs';
import {accountWorker} from './app.mjs';
export default accountWorker({sessionFactory:createSession});
