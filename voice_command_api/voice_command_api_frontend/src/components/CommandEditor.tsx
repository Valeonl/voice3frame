import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  IconButton,
  Typography,
  List,
  ListItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  Card,
  CardContent,
  Divider,
  Grid,
  FormControlLabel,
  Checkbox,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Command, CommandParameter, PromptConfig } from '../types/commands';

interface CommandEditorProps {
  onSave: (config: PromptConfig) => void;
  initialConfig?: PromptConfig;
  onClose: () => void;
}

const CommandEditor: React.FC<CommandEditorProps> = ({ onSave, initialConfig, onClose }) => {
  const [config, setConfig] = useState<PromptConfig>({
    role: '',
    commands: [],
  });
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newParameter, setNewParameter] = useState<CommandParameter>({
    name: '',
    description: '',
    defaultValue: '',
    possibleValues: []
  });
  const [newExample, setNewExample] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [responseFormat, setResponseFormat] = useState(`[
{
    "command": "название_команды 1",
    "confidence": 0.95,
    "parameters": {}
},
{
    "command": "название_команды 2",
    "confidence": 0.91,
    "parameters": {}
}
]`);
  const [newPossibleValue, setNewPossibleValue] = useState('');

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  useEffect(() => {
    if (!initialConfig) {
      import('../config/defaultCommands').then(({ defaultConfig }) => {
        setConfig(defaultConfig);
      });
    }
  }, [initialConfig]);

  const handleRoleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, role: event.target.value });
  };

  const handleAddCommand = () => {
    setEditingCommand({
      id: Date.now().toString(),
      displayName: '',
      className: '',
      description: '',
      parameters: [],
      examples: [],
    });
    setIsDialogOpen(true);
  };

  const handleEditCommand = (command: Command) => {
    setEditingCommand(JSON.parse(JSON.stringify(command)));
    setIsDialogOpen(true);
  };

  const handleDeleteCommand = (commandId: string) => {
    setConfig({
      ...config,
      commands: config.commands.filter((cmd) => cmd.id !== commandId),
    });
  };

  const handleSaveCommand = () => {
    if (editingCommand) {
      const newCommands = editingCommand.id
        ? config.commands.map((cmd) =>
            cmd.id === editingCommand.id ? { ...editingCommand } : cmd
          )
        : [...config.commands, { ...editingCommand }];

      setConfig({
        ...config,
        commands: newCommands,
      });
    }
    setIsDialogOpen(false);
    setEditingCommand(null);
  };

  const handleAddParameter = () => {
    if (editingCommand && newParameter.name) {
      setEditingCommand({
        ...editingCommand,
        parameters: [...editingCommand.parameters, { ...newParameter }],
      });
      setNewParameter({
        name: '',
        description: '',
        defaultValue: '',
        possibleValues: []
      });
    }
  };

  const handleAddExample = () => {
    if (editingCommand && newExample) {
      setEditingCommand({
        ...editingCommand,
        examples: [...editingCommand.examples, newExample],
      });
      setNewExample('');
    }
  };

  const handleDeleteParameter = (paramName: string) => {
    if (editingCommand) {
      setEditingCommand({
        ...editingCommand,
        parameters: editingCommand.parameters.filter(p => p.name !== paramName)
      });
    }
  };

  const handleDeleteExample = (example: string) => {
    if (editingCommand) {
      setEditingCommand({
        ...editingCommand,
        examples: editingCommand.examples.filter(e => e !== example)
      });
    }
  };

  const handleEditParameter = (index: number, field: keyof CommandParameter, value: any) => {
    if (editingCommand) {
      const updatedParameters = [...editingCommand.parameters];
      updatedParameters[index] = {
        ...updatedParameters[index],
        [field]: value
      };
      setEditingCommand({
        ...editingCommand,
        parameters: updatedParameters
      });
    }
  };

  const generatePromptText = (): string => {
    let promptText = `${config.role}\n\nДоступные команды:\n`;
    
    config.commands.forEach((cmd, index) => {
      promptText += `${index + 1}. ${cmd.className} - ${cmd.description}\n`;
      if (cmd.examples.length > 0) {
        promptText += '   Примеры:\n';
        cmd.examples.forEach(example => {
          promptText += `   - "${example}"\n`;
        });
      }
      if (cmd.parameters.length > 0) {
        promptText += '   Параметры:\n';
        cmd.parameters.forEach(param => {
          promptText += `     - ${param.name}: ${param.description}`;
          if (param.defaultValue) {
            promptText += ` (по умолчанию: "${param.defaultValue}")`;
          }
          if (param.possibleValues && param.possibleValues.length > 0) {
            promptText += `\n       Возможные значения: [${param.possibleValues.join(', ')}]`;
          }
          promptText += '\n';
        });
      }
      promptText += '\n';
    });

    promptText += '\nФормат ответа:\n';
    promptText += responseFormat;

    return promptText;
  };

  const handleSaveConfig = () => {
    const promptConfig = {
      ...config,
      promptText: generatePromptText(),
    };
    onSave(promptConfig);
  };

  return (
    <Dialog 
      open={true} 
      maxWidth="lg" 
      fullWidth
      onClose={onClose}
      PaperProps={{
        sx: {
          height: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle>
        Редактор команд
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5">Редактор команд</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6">Общие настройки промпта</Typography>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Роль модели"
            value={config.role}
            onChange={handleRoleChange}
            sx={{ mb: 2 }}
          />

          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Команды</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddCommand}
              >
                Добавить команду
              </Button>
            </Box>

            <List>
              {config.commands.map((command) => (
                <Card key={command.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6">{command.displayName}</Typography>
                      <Box>
                        <IconButton onClick={() => handleEditCommand(command)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteCommand(command.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                    <Typography color="textSecondary" gutterBottom>
                      Класс: {command.className}
                    </Typography>
                    <Typography variant="body2">{command.description}</Typography>
                    
                    {command.parameters.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2">Параметры:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {command.parameters.map((param, index) => (
                            <Tooltip key={index} title={param.description}>
                              <Chip
                                label={param.name}
                                size="small"
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      </Box>
                    )}
                    
                    {command.examples.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2">Примеры:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {command.examples.map((example, index) => (
                            <Chip
                              key={index}
                              label={example}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </List>
          </Paper>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Формат ответа
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={responseFormat}
            onChange={(e) => setResponseFormat(e.target.value)}
            variant="outlined"
          />
        </Box>
      </DialogContent>

      <DialogActions 
        sx={{ 
          borderTop: '1px solid #e0e0e0',
          p: 2,
          backgroundColor: '#f5f5f5',
          position: 'sticky',
          bottom: 0
        }}
      >
        <Button
          startIcon={<VisibilityIcon />}
          onClick={() => setPreviewOpen(true)}
          variant="outlined"
        >
          Предпросмотр
        </Button>
        <Button onClick={handleSaveConfig} variant="contained" color="primary">
          Сохранить
        </Button>
      </DialogActions>

      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Предпросмотр промпта
          <IconButton
            onClick={() => setPreviewOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <pre style={{ 
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            backgroundColor: '#f5f5f5',
            padding: '16px',
            borderRadius: '4px'
          }}>
            {generatePromptText()}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingCommand?.id ? 'Редактирование команды' : 'Новая команда'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
            <TextField
              fullWidth
              label="Отображаемое имя"
              value={editingCommand?.displayName || ''}
              onChange={(e) => editingCommand && setEditingCommand({
                ...editingCommand,
                displayName: e.target.value
              })}
            />
            
            <TextField
              fullWidth
              label="Класс команды"
              value={editingCommand?.className || ''}
              onChange={(e) => editingCommand && setEditingCommand({
                ...editingCommand,
                className: e.target.value
              })}
            />
            
            <TextField
              fullWidth
              label="Описание"
              multiline
              rows={2}
              value={editingCommand?.description || ''}
              onChange={(e) => editingCommand && setEditingCommand({
                ...editingCommand,
                description: e.target.value
              })}
            />

            <Typography variant="subtitle1" gutterBottom>Параметры</Typography>
            {editingCommand?.parameters.map((param, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Имя параметра"
                      value={param.name}
                      onChange={(e) => handleEditParameter(index, 'name', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Описание"
                      value={param.description}
                      onChange={(e) => handleEditParameter(index, 'description', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      label="Значение по умолчанию"
                      value={param.defaultValue || ''}
                      onChange={(e) => handleEditParameter(index, 'defaultValue', e.target.value)}
                      helperText="Если параметр не определен"
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton 
                      color="error" 
                      onClick={() => handleDeleteParameter(param.name)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Возможные значения:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                      {param.possibleValues?.map((value, valueIndex) => (
                        <Chip
                          key={valueIndex}
                          label={value}
                          onDelete={() => {
                            const updatedValues = param.possibleValues?.filter((_, i) => i !== valueIndex);
                            handleEditParameter(index, 'possibleValues', updatedValues);
                          }}
                        />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        label="Новое значение"
                        value={newPossibleValue}
                        onChange={(e) => setNewPossibleValue(e.target.value)}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          if (newPossibleValue) {
                            const updatedValues = [...(param.possibleValues || []), newPossibleValue];
                            handleEditParameter(index, 'possibleValues', updatedValues);
                            setNewPossibleValue('');
                          }
                        }}
                        disabled={!newPossibleValue}
                      >
                        Добавить
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            ))}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="Новый параметр"
                value={newParameter.name}
                onChange={(e) => setNewParameter({ ...newParameter, name: e.target.value })}
                size="small"
              />
              <Button
                variant="outlined"
                onClick={handleAddParameter}
                disabled={!newParameter.name}
              >
                Добавить параметр
              </Button>
            </Box>

            <Typography variant="subtitle1" gutterBottom>Примеры</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {editingCommand?.examples.map((example, index) => (
                <Chip
                  key={index}
                  label={example}
                  onDelete={() => handleDeleteExample(example)}
                />
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                label="Новый пример"
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                size="small"
              />
              <Button
                variant="outlined"
                onClick={handleAddExample}
                disabled={!newExample}
              >
                Добавить
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleSaveCommand} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default CommandEditor; 