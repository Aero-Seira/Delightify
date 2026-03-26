/**
 * 可搜索的下拉选择组件
 * 
 * 支持：
 * - 点击展开下拉列表
 * - 输入过滤选项
 * - 键盘导航（上下箭头、回车、ESC）
 * - 清空选择
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import styles from './style.module.css';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  prefixIcon?: React.ReactNode;
  onChange: (value: string) => void;
  className?: string;
  title?: string;
}

export default function SearchableSelect({
  value,
  options,
  placeholder = '请选择...',
  prefixIcon,
  onChange,
  className = '',
  title,
}: SearchableSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 当前选中的选项
  const selectedOption = useMemo(() => 
    options.find(opt => opt.value === value),
    [options, value]
  );

  // 过滤后的选项
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(term) ||
      opt.value.toLowerCase().includes(term) ||
      opt.description?.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
          setSearchTerm('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  }, [isOpen, filteredOptions, highlightedIndex, onChange]);

  // 处理选择
  const handleSelect = useCallback((option: SearchableSelectOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);

  // 处理清除
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  }, [onChange]);

  // 高亮项滚动到视野
  useEffect(() => {
    if (isOpen && filteredOptions.length > 0) {
      const highlightedEl = containerRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
      highlightedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen, filteredOptions.length]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className} ${isOpen ? styles.open : ''}`}
      title={title}
    >
      {/* 触发器 / 输入框 */}
      <div
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {prefixIcon && (
          <span className={styles.prefixIcon}>{prefixIcon}</span>
        )}
        
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedOption?.label || placeholder}
            className={styles.searchInput}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`${styles.selectedLabel} ${!selectedOption ? styles.placeholder : ''}`}>
            {selectedOption?.label || placeholder}
          </span>
        )}
        
        {/* 清除按钮 */}
        {value && !isOpen && (
          <button
            className={styles.clearBtn}
            onClick={handleClear}
            title="清除选择"
            tabIndex={-1}
          >
            ×
          </button>
        )}
        
        {/* 下拉箭头 */}
        <svg
          className={`${styles.arrow} ${isOpen ? styles.open : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* 下拉列表 */}
      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {filteredOptions.length === 0 ? (
            <div className={styles.empty}>无匹配选项</div>
          ) : (
            <>
              {/* 计数提示 */}
              <div className={styles.count}>
                共 {filteredOptions.length} 个选项
                {searchTerm && `（过滤自 ${options.length} 个）`}
              </div>
              
              {/* 选项列表 */}
              <div className={styles.optionsList}>
                {filteredOptions.map((option, index) => (
                  <div
                    key={option.value}
                    data-index={index}
                    className={`${styles.option} ${
                      option.value === value ? styles.selected : ''
                    } ${index === highlightedIndex ? styles.highlighted : ''}`}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    aria-selected={option.value === value}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.description && (
                      <span className={styles.optionDescription}>{option.description}</span>
                    )}
                    {option.value === value && (
                      <svg className={styles.checkmark} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
