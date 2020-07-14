import 'source-map-support/register';
import './commands/create-release';
import './commands/parse';
import './commands/tag';
import './commands/github-actions';
import { program } from 'commander';

program.parse();
